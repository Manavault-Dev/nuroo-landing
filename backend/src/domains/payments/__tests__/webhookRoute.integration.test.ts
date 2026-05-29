/**
 * Integration tests: POST /webhooks/finik — Fastify route level
 *
 * These tests spin up a real Fastify instance with the webhook route registered
 * and verify the full HTTP request → handler → updateInvoiceStatus path.
 *
 * NOTE: No fastify-raw-body plugin — the route falls back to JSON.stringify(request.body)
 * when rawBody is absent. The test signs the canonical JSON to match that path.
 *
 * They complement the unit tests in webhook.test.ts (which test FinikPaymentProvider
 * directly) by covering the full route: signature check, idempotency guard, orgId
 * extraction, status mapping, and correct delegation to updateInvoiceStatus.
 */
import crypto from 'crypto'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'

// ─── Mocks (hoisted before real imports) ─────────────────────────────────────

vi.mock('../../../config/index.js', () => ({
  config: {
    FINIK_WEBHOOK_SECRET: 'integration-test-secret',
    BACKEND_PUBLIC_URL: 'http://localhost:3101',
    NEXT_PUBLIC_B2B_URL: 'http://localhost:3000',
  },
}))

const mockUpdateInvoiceStatus = vi.fn().mockResolvedValue({})

vi.mock('../invoice.service.js', () => ({
  updateInvoiceStatus: mockUpdateInvoiceStatus,
  getInvoice: vi.fn().mockResolvedValue(null),
}))

vi.mock('@sentry/node', () => ({
  captureMessage: vi.fn(),
  captureException: vi.fn(),
}))

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => new Date() },
    },
  },
}))

// ─── Mock Firestore ───────────────────────────────────────────────────────────

let _mockEventExists = false

vi.mock('../../../infrastructure/database/firebase.js', () => ({
  getFirestore: vi.fn(() => {
    const docRef = {
      get: vi.fn().mockImplementation(async () => ({ exists: _mockEventExists })),
      set: vi.fn().mockResolvedValue({}),
    }
    return {
      doc: vi.fn().mockReturnValue(docRef),
    }
  }),
}))

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = 'integration-test-secret'

/**
 * Sign the *canonical* body — the route does JSON.stringify(request.body) when
 * there is no rawBody plugin, so we must sign the same serialization.
 */
function signCanonical(obj: Record<string, unknown>, secret = WEBHOOK_SECRET): string {
  const canonical = JSON.stringify(obj)
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex')
}

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  const { webhookRoutes } = await import('../webhook.routes.js')
  await app.register(webhookRoutes)
  await app.ready()
  return app
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /webhooks/finik — Fastify route integration', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.clearAllMocks()
    _mockEventExists = false
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  // ── Signature verification ─────────────────────────────────────────────────

  it('returns 400 with INVALID_SIGNATURE when HMAC is wrong', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': 'deadbeef0000000000000000000000000000000000000000000000000000dead',
      },
      payload: { reference: 'org1__inv_001', status: 'completed' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'INVALID_SIGNATURE' })
  })

  it('returns 400 with INVALID_SIGNATURE when header is absent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: { 'content-type': 'application/json' },
      payload: { reference: 'org1__inv_001', status: 'completed' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ code: 'INVALID_SIGNATURE' })
  })

  it('returns 200 and processes when signature is valid', async () => {
    const payload = {
      reference: 'orgGood__invGood',
      transactionId: 'txn_good_001',
      status: 'completed',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)
  })

  it('accepts x-webhook-signature header as fallback', async () => {
    const payload = {
      reference: 'orgAlt__invAlt',
      transactionId: 'txn_alt_sig',
      status: 'paid',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signCanonical(payload),
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateInvoiceStatus).toHaveBeenCalledOnce()
  })

  // ── updateInvoiceStatus delegation ────────────────────────────────────────

  it('calls updateInvoiceStatus(db, orgId, invoiceId, "paid", Date) for "completed"', async () => {
    const payload = {
      reference: 'orgABC__inv123',
      transactionId: 'txn_paid_001',
      status: 'completed',
    }

    await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    expect(mockUpdateInvoiceStatus).toHaveBeenCalledOnce()
    const [_db, orgId, invoiceId, status, paidAt] = mockUpdateInvoiceStatus.mock.calls[0]
    expect(orgId).toBe('orgABC')
    expect(invoiceId).toBe('inv123')
    expect(status).toBe('paid')
    expect(paidAt).toBeInstanceOf(Date)
  })

  it('does NOT pass paidAt for non-paid status', async () => {
    const payload = {
      reference: 'orgF__invFail',
      transactionId: 'txn_fail_001',
      status: 'declined',
    }

    await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    const [, orgId, invoiceId, status, paidAt] = mockUpdateInvoiceStatus.mock.calls[0]
    expect(orgId).toBe('orgF')
    expect(invoiceId).toBe('invFail')
    expect(status).toBe('failed')
    expect(paidAt).toBeUndefined()
  })

  // ── Idempotency ────────────────────────────────────────────────────────────

  it('returns { ok: true, idempotent: true } and skips update for duplicate transactionId', async () => {
    _mockEventExists = true

    const payload = {
      reference: 'orgDup__invDup',
      transactionId: 'txn_already_seen',
      status: 'completed',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, idempotent: true })
    expect(mockUpdateInvoiceStatus).not.toHaveBeenCalled()
  })

  // ── No invoiceId edge case ─────────────────────────────────────────────────

  it('returns { ok: true, skipped } and skips update when no invoiceId can be extracted', async () => {
    const payload = { reference: '', transactionId: '', PaymentId: '', status: 'completed' }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ ok: true, skipped: 'no invoiceId' })
    expect(mockUpdateInvoiceStatus).not.toHaveBeenCalled()
  })

  // ── No orgId — plain reference ─────────────────────────────────────────────

  it('skips updateInvoiceStatus when reference has no __ (no orgId)', async () => {
    // Plain reference without __ → orgId is '' → route logs warning and skips
    const payload = {
      reference: 'inv_plain_no_org',
      transactionId: 'txn_noorg',
      status: 'completed',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/finik',
      headers: {
        'content-type': 'application/json',
        'x-signature': signCanonical(payload),
      },
      payload,
    })

    expect(res.statusCode).toBe(200)
    expect(mockUpdateInvoiceStatus).not.toHaveBeenCalled()
  })
})

// ─── Status propagation contract ─────────────────────────────────────────────
//
// Ensures every Finik terminal status maps to the correct value in Firestore.

describe('Finik → Firestore status propagation contract', () => {
  const cases: Array<{
    finikStatus: string
    expectedDbStatus: string
    expectPaidAt: boolean
  }> = [
    { finikStatus: 'completed', expectedDbStatus: 'paid', expectPaidAt: true },
    { finikStatus: 'success',   expectedDbStatus: 'paid', expectPaidAt: true },
    { finikStatus: 'paid',      expectedDbStatus: 'paid', expectPaidAt: true },
    { finikStatus: 'failed',    expectedDbStatus: 'failed', expectPaidAt: false },
    { finikStatus: 'error',     expectedDbStatus: 'failed', expectPaidAt: false },
    { finikStatus: 'declined',  expectedDbStatus: 'failed', expectPaidAt: false },
    { finikStatus: 'expired',   expectedDbStatus: 'expired', expectPaidAt: false },
    { finikStatus: 'canceled',  expectedDbStatus: 'canceled', expectPaidAt: false },
    { finikStatus: 'cancelled', expectedDbStatus: 'canceled', expectPaidAt: false },
    { finikStatus: 'pending',   expectedDbStatus: 'pending', expectPaidAt: false },
  ]

  it.each(cases)(
    'Finik "$finikStatus" → Firestore "$expectedDbStatus" (paidAt: $expectPaidAt)',
    async ({ finikStatus, expectedDbStatus, expectPaidAt }) => {
      vi.clearAllMocks()
      _mockEventExists = false

      const app = Fastify({ logger: false })
      const { webhookRoutes } = await import('../webhook.routes.js')
      await app.register(webhookRoutes)
      await app.ready()

      const payload = {
        reference: `orgProp__inv_${finikStatus}`,
        transactionId: `txn_prop_${finikStatus}_${Date.now()}`,
        status: finikStatus,
      }

      await app.inject({
        method: 'POST',
        url: '/webhooks/finik',
        headers: {
          'content-type': 'application/json',
          'x-signature': signCanonical(payload),
        },
        payload,
      })

      await app.close()

      expect(mockUpdateInvoiceStatus).toHaveBeenCalledOnce()
      const [, orgId, invoiceId, status, paidAt] = mockUpdateInvoiceStatus.mock.calls[0]

      expect(orgId).toBe('orgProp')
      expect(invoiceId).toBe(`inv_${finikStatus}`)
      expect(status).toBe(expectedDbStatus)

      if (expectPaidAt) {
        expect(paidAt).toBeInstanceOf(Date)
      } else {
        expect(paidAt).toBeUndefined()
      }
    }
  )
})
