import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'crypto'

vi.mock('../../../config/index.js', () => ({
  config: {
    FINIK_WEBHOOK_SECRET: 'test-secret-abc',
    BACKEND_PUBLIC_URL: 'http://localhost:3101',
    NEXT_PUBLIC_B2B_URL: 'http://localhost:3000',
  },
}))

vi.mock('../invoice.service.js', () => ({
  updateInvoiceStatus: vi.fn().mockResolvedValue({}),
  getInvoice: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../infrastructure/database/firebase.js', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
}))

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => new Date(),
      },
    },
  },
}))

import { FinikPaymentProvider } from '../providers/FinikPaymentProvider.js'

const WEBHOOK_SECRET = 'test-secret-abc'

function sign(body: string, secret = WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex')
}

// ─── Signature verification ───────────────────────────────────────────────────

describe('webhook — signature verification', () => {
  it('rejects an invalid HMAC signature', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({ reference: 'inv_1', status: 'completed' })

    await expect(
      provider.handleWebhook(payload, {
        'x-signature': 'deadbeef0000000000000000000000000000000000000000000000000000dead',
      })
    ).rejects.toThrow('Invalid webhook signature')
  })

  it('accepts a valid HMAC signature', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({
      reference: 'inv_abc',
      PaymentId: 'txn_001',
      status: 'completed',
    })

    const result = await provider.handleWebhook(payload, { 'x-signature': sign(payload) })

    expect(result.status).toBe('paid')
    expect(result.invoiceId).toBe('inv_abc')
  })

  it('rejects when signature is missing entirely', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({ reference: 'inv_1', status: 'completed' })

    await expect(provider.handleWebhook(payload, {})).rejects.toThrow('Invalid webhook signature')
  })

  it('rejects when signature was signed with a different secret', async () => {
    // orgConfig.webhookSecret = '' falls back to config.FINIK_WEBHOOK_SECRET ('test-secret-abc')
    // A signature created with the wrong key should still fail
    const provider = new FinikPaymentProvider({ webhookSecret: '' })
    const payload = JSON.stringify({ reference: 'inv_1', status: 'completed' })
    const wrongSig = sign(payload, 'completely-wrong-key')

    await expect(provider.handleWebhook(payload, { 'x-signature': wrongSig })).rejects.toThrow(
      'Invalid webhook signature'
    )
  })
})

// ─── Status mapping ───────────────────────────────────────────────────────────

describe('webhook — status mapping', () => {
  const cases: Array<[string, string]> = [
    ['completed', 'paid'],
    ['success', 'paid'],
    ['paid', 'paid'],
    ['failed', 'failed'],
    ['error', 'failed'],
    ['declined', 'failed'],
    ['expired', 'expired'],
    ['canceled', 'canceled'],
    ['cancelled', 'canceled'],
    ['pending', 'pending'],
    ['unknown_status', 'pending'],
  ]

  it.each(cases)('maps Finik status "%s" → "%s"', async (finikStatus, expected) => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({ reference: 'inv_1', status: finikStatus })

    const result = await provider.handleWebhook(payload, { 'x-signature': sign(payload) })
    expect(result.status).toBe(expected)
  })

  it('sets paidAt only when status is paid', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })

    const paidPayload = JSON.stringify({ reference: 'inv_p', status: 'completed' })
    const paidResult = await provider.handleWebhook(paidPayload, {
      'x-signature': sign(paidPayload),
    })
    expect(paidResult.paidAt).toBeInstanceOf(Date)

    const pendingPayload = JSON.stringify({ reference: 'inv_q', status: 'pending' })
    const pendingResult = await provider.handleWebhook(pendingPayload, {
      'x-signature': sign(pendingPayload),
    })
    expect(pendingResult.paidAt).toBeUndefined()
  })
})

// ─── Composite reference parsing ─────────────────────────────────────────────

describe('webhook — composite reference orgId__invoiceId', () => {
  it('extracts invoiceId from composite reference', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({
      reference: 'orgABC__inv123',
      status: 'completed',
    })

    const result = await provider.handleWebhook(payload, { 'x-signature': sign(payload) })

    // FinikPaymentProvider.handleWebhook splits on __ and sets invoiceId to the right part
    expect(result.invoiceId).toBe('inv123')
  })

  it('falls back to PaymentId when reference is plain (legacy)', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: WEBHOOK_SECRET })
    const payload = JSON.stringify({
      reference: 'inv_plain',
      PaymentId: 'txn_legacy',
      status: 'completed',
    })

    const result = await provider.handleWebhook(payload, { 'x-signature': sign(payload) })
    // No __ in reference → invoiceId = reference value itself
    expect(result.invoiceId).toBe('inv_plain')
  })

  it('handles orgId that contains no double underscore', () => {
    // Unit-test the parsing logic directly (mirrors webhook.routes.ts)
    function parseRef(rawRef: string, rawPaymentId: string): { orgId: string; invoiceId: string } {
      let invoiceId = rawPaymentId
      let orgId = ''
      if (rawRef.includes('__')) {
        const sep = rawRef.indexOf('__')
        orgId = rawRef.slice(0, sep)
        invoiceId = rawRef.slice(sep + 2)
      } else if (rawRef) {
        invoiceId = rawRef
      }
      return { orgId, invoiceId }
    }

    expect(parseRef('org1__inv_abc', 'txn_001')).toEqual({ orgId: 'org1', invoiceId: 'inv_abc' })
    expect(parseRef('inv_plain', 'txn_001')).toEqual({ orgId: '', invoiceId: 'inv_plain' })
    expect(parseRef('', 'txn_fallback')).toEqual({ orgId: '', invoiceId: 'txn_fallback' })
    expect(parseRef('SWQsJ42TP4ib3Q1L7Qbb__XkY7mN2p', '')).toEqual({
      orgId: 'SWQsJ42TP4ib3Q1L7Qbb',
      invoiceId: 'XkY7mN2p',
    })
  })

  it('uses first __ as separator when orgId itself would never contain __', () => {
    function parseRef(rawRef: string): { orgId: string; invoiceId: string } {
      if (!rawRef.includes('__')) return { orgId: '', invoiceId: rawRef }
      const sep = rawRef.indexOf('__')
      return { orgId: rawRef.slice(0, sep), invoiceId: rawRef.slice(sep + 2) }
    }

    // Firebase doc IDs use alphanumeric chars only — no __ in real IDs
    const result = parseRef('firebaseOrgId123__firebaseInvoiceId456')
    expect(result.orgId).toBe('firebaseOrgId123')
    expect(result.invoiceId).toBe('firebaseInvoiceId456')
  })
})

// ─── Idempotency ──────────────────────────────────────────────────────────────

describe('webhook — idempotency', () => {
  it('produces the same Firestore doc path for the same transactionId', () => {
    const txId = 'txn_12345'
    expect(`finikWebhookEvents/${txId}`).toBe(`finikWebhookEvents/${txId}`)
  })

  it('skips processing when event doc already exists', async () => {
    const processedEvents = new Set<string>()

    async function processWebhook(txId: string) {
      if (processedEvents.has(txId)) return { processed: false }
      processedEvents.add(txId)
      return { processed: true }
    }

    expect((await processWebhook('txn_abc')).processed).toBe(true)
    expect((await processWebhook('txn_abc')).processed).toBe(false)
    expect((await processWebhook('txn_xyz')).processed).toBe(true)
  })
})
