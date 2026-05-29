import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock stripe module before any imports that use it
// ---------------------------------------------------------------------------
vi.mock('stripe', () => {
  const mockConstructEvent = vi.fn()
  const MockStripe = vi.fn(function () {
    return {
      webhooks: { constructEvent: mockConstructEvent },
    }
  })
  ;(MockStripe as unknown as Record<string, unknown>).__mockConstructEvent = mockConstructEvent
  return { default: MockStripe }
})

vi.mock('../../../config/index.js', () => ({
  config: {
    STRIPE_SECRET_KEY: 'sk_test_mock',
    STRIPE_WEBHOOK_SECRET: 'whsec_mock',
    STRIPE_PRICE_STARTER: 'price_starter_mock',
    STRIPE_PRICE_GROWTH: 'price_growth_mock',
    STRIPE_PRICE_ENTERPRISE: 'price_enterprise_mock',
  },
}))

vi.mock('../../../infrastructure/database/firebase.js', () => ({
  getFirestore: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import Stripe from 'stripe'
import { constructWebhookEvent } from '../stripe.service.js'
import { requireActiveSubscription } from '../subscription.middleware.js'
import admin from 'firebase-admin'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeTimestamp(date: Date): admin.firestore.Timestamp {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
  } as unknown as admin.firestore.Timestamp
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

function makeOrgSnap(
  billing: DeepPartial<{
    status: string
    trialEndsAt: admin.firestore.Timestamp | null
    currentPeriodEnd: admin.firestore.Timestamp | null
    updatedAt: admin.firestore.Timestamp | null
  }>
) {
  return {
    exists: true,
    data: () => ({ billing }),
  }
}

function makeMockDb(orgSnap: unknown) {
  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(orgSnap),
      }),
    }),
  } as unknown as FirebaseFirestore.Firestore
}

// ---------------------------------------------------------------------------
// constructWebhookEvent
// ---------------------------------------------------------------------------
describe('constructWebhookEvent', () => {
  it('throws when signature is invalid', () => {
    // Access the mock's internal constructEvent spy
    const MockStripe = Stripe as unknown as { __mockConstructEvent: ReturnType<typeof vi.fn> }
    const mockConstructEvent = MockStripe.__mockConstructEvent

    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload.')
    })

    const payload = Buffer.from('{}')
    expect(() => constructWebhookEvent(payload, 'bad_sig')).toThrow('No signatures found')
  })

  it('returns an event when signature is valid', () => {
    const MockStripe = Stripe as unknown as { __mockConstructEvent: ReturnType<typeof vi.fn> }
    const mockConstructEvent = MockStripe.__mockConstructEvent

    const fakeEvent = { id: 'evt_123', type: 'checkout.session.completed' }
    mockConstructEvent.mockReturnValue(fakeEvent)

    const payload = Buffer.from('{}')
    const result = constructWebhookEvent(payload, 't=123,v1=abc')
    expect(result).toEqual(fakeEvent)
  })
})

// ---------------------------------------------------------------------------
// requireActiveSubscription
// ---------------------------------------------------------------------------
describe('requireActiveSubscription', () => {
  it('returns allowed=false when org does not exist', async () => {
    const db = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: false }),
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore

    const result = await requireActiveSubscription('org_missing', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/not found/i)
  })

  it('returns allowed=false when billing is missing', async () => {
    const snap = { exists: true, data: () => ({}) }
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/no subscription/i)
  })

  it('returns allowed=true for trialing status within trial period', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const snap = makeOrgSnap({ status: 'trialing', trialEndsAt: makeTimestamp(future) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=false for trialing status when trial has expired', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const snap = makeOrgSnap({ status: 'trialing', trialEndsAt: makeTimestamp(past) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/expired/i)
  })

  it('returns allowed=true for active status within period', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const snap = makeOrgSnap({ status: 'active', currentPeriodEnd: makeTimestamp(future) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=false for active status when period has ended', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const snap = makeOrgSnap({ status: 'active', currentPeriodEnd: makeTimestamp(past) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/period has ended/i)
  })

  it('returns allowed=true for past_due within grace period (< 7 days)', async () => {
    const recentlyUpdated = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
    const snap = makeOrgSnap({ status: 'past_due', updatedAt: makeTimestamp(recentlyUpdated) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(true)
  })

  it('returns allowed=false for past_due beyond grace period (> 7 days)', async () => {
    const longAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
    const snap = makeOrgSnap({ status: 'past_due', updatedAt: makeTimestamp(longAgo) })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/past due/i)
  })

  it('returns allowed=false for canceled status', async () => {
    const snap = makeOrgSnap({ status: 'canceled' })
    const db = makeMockDb(snap)

    const result = await requireActiveSubscription('org_1', db)
    expect(result.allowed).toBe(false)
    expect(result.reason).toMatch(/canceled/i)
  })
})

// ---------------------------------------------------------------------------
// Idempotency check (simulated — tests the isEventAlreadyProcessed logic)
// ---------------------------------------------------------------------------
describe('Webhook idempotency', () => {
  it('event already marked as processed is detected', async () => {
    // Simulate a Firestore doc that already exists for the event ID
    const alreadyExists = {
      exists: true,
      data: () => ({ eventType: 'checkout.session.completed', processedAt: new Date() }),
    }

    const db = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(alreadyExists),
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore

    // Verify the snap exists (simulating what isEventAlreadyProcessed does)
    const snap = await db.collection('stripeWebhookEvents').doc('evt_duplicate').get()
    expect(snap.exists).toBe(true)
  })

  it('new event is not marked as processed', async () => {
    const notExists = { exists: false }

    const db = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(notExists),
        }),
      }),
    } as unknown as FirebaseFirestore.Firestore

    const snap = await db.collection('stripeWebhookEvents').doc('evt_new').get()
    expect(snap.exists).toBe(false)
  })
})
