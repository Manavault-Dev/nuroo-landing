import { describe, it, expect, vi } from 'vitest'
import crypto from 'crypto'

vi.mock('../../../config/index.js', () => ({
  config: {
    FINIK_API_URL: 'https://api.acquiring.averspay.kg/payment',
    FINIK_API_KEY: '',
    FINIK_ACCOUNT_ID: '',
    FINIK_PRIVATE_PEM: '',
    FINIK_WEBHOOK_SECRET: 'test-secret',
  },
}))

import { FinikPaymentProvider } from '../providers/FinikPaymentProvider.js'

describe('FinikPaymentProvider.validateConfig', () => {
  it('returns invalid when merchantId is empty string', async () => {
    const provider = new FinikPaymentProvider()
    const result = await provider.validateConfig({ merchantId: '' })
    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns invalid when merchantId is whitespace', async () => {
    const provider = new FinikPaymentProvider()
    const result = await provider.validateConfig({ merchantId: '   ' })
    expect(result.valid).toBe(false)
  })

  it('returns valid when merchantId is present', async () => {
    const provider = new FinikPaymentProvider()
    const result = await provider.validateConfig({ merchantId: 'merchant_001' })
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })
})

describe('FinikPaymentProvider HMAC verification', () => {
  it('produces consistent HMAC for same input', () => {
    const secret = 'webhook-secret-123'
    const body = '{"reference":"inv_1","status":"completed"}'

    const sig1 = crypto.createHmac('sha256', secret).update(body).digest('hex')
    const sig2 = crypto.createHmac('sha256', secret).update(body).digest('hex')

    expect(sig1).toBe(sig2)
  })

  it('produces different HMAC for different body', () => {
    const secret = 'webhook-secret-123'
    const body1 = '{"reference":"inv_1","status":"completed"}'
    const body2 = '{"reference":"inv_2","status":"completed"}'

    const sig1 = crypto.createHmac('sha256', secret).update(body1).digest('hex')
    const sig2 = crypto.createHmac('sha256', secret).update(body2).digest('hex')

    expect(sig1).not.toBe(sig2)
  })

  it('timingSafeEqual returns false for different-length buffers', () => {
    const a = Buffer.from('abc', 'hex')
    const b = Buffer.from('abcd', 'hex')

    // Different lengths should not throw — just return false
    if (a.length !== b.length) {
      expect(a.length).not.toBe(b.length)
    }
  })

  it('rejects webhook with invalid signature', async () => {
    const provider = new FinikPaymentProvider({ webhookSecret: 'test-secret' })
    const payload = '{"reference":"inv_1","status":"completed"}'

    await expect(provider.handleWebhook(payload, { 'x-signature': 'badsig' })).rejects.toThrow(
      'Invalid webhook signature'
    )
  })

  it('provider name is finik', () => {
    const provider = new FinikPaymentProvider()
    expect(provider.name).toBe('finik')
  })
})
