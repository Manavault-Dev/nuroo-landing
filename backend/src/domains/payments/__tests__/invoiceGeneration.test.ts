import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

vi.mock('../providers/registry.js', () => ({
  getOrgPaymentProvider: vi.fn(),
}))

vi.mock('../billingProfile.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../billingProfile.service.js')>()
  return { ...actual }
})

vi.mock('../../../config/index.js', () => ({
  config: {
    BACKEND_PUBLIC_URL: 'http://localhost:3101',
    NEXT_PUBLIC_B2B_URL: 'http://localhost:3000',
  },
}))

vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => new Date(),
        increment: (n: number) => n,
      },
    },
  },
}))

import { getOrgPaymentProvider } from '../providers/registry.js'
import {
  generateMonthlyInvoicesForOrg,
  markOverdueInvoicesForOrg,
} from '../invoiceGeneration.service.js'

// ─── Mock DB factory ──────────────────────────────────────────────────────────

function makeActiveProfileDoc(overrides: Record<string, unknown> = {}) {
  // nextInvoiceDate defaults to yesterday so it is clearly <= now
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return {
    id: 'profile1',
    data: () => ({
      orgId: 'org1',
      childId: 'child1',
      parentId: 'parent1',
      amount: 4000,
      currency: 'KGS',
      billingCycle: 'monthly',
      dueDayOfMonth: 5,
      status: 'active',
      provider: 'finik',
      nextInvoiceDate: { toDate: () => yesterday },
      createdBy: 'admin1',
      createdAt: { toDate: () => new Date() },
      updatedAt: { toDate: () => new Date() },
      ...overrides,
    }),
  }
}

function makeInvoiceDoc(overrides: Record<string, unknown> = {}) {
  const today = new Date()
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
  return {
    id: 'inv1',
    data: () => ({
      orgId: 'org1',
      billingProfileId: 'profile1',
      parentId: 'parent1',
      childId: 'child1',
      amount: 4000,
      currency: 'KGS',
      status: 'pending',
      periodStart,
      periodEnd: new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString(),
      dueDate: '2099-01-01',
      paymentUrl: null,
      createdAt: { toDate: () => new Date() },
      updatedAt: { toDate: () => new Date() },
      ...overrides,
    }),
  }
}

/**
 * Builds a Firestore mock that handles the complex chain:
 *   db.collection(path).where(...).get()
 *   db.collection(path).where(...).limit(...).get()
 *   db.collection(path).doc() → new invoice ref
 *   db.collection(path).add(...) → activity feed
 *   db.doc(path).update(...)
 *   db.batch()
 */
function makeGenerationMockDb({
  profiles = [] as ReturnType<typeof makeActiveProfileDoc>[],
  existingInvoices = [] as ReturnType<typeof makeInvoiceDoc>[],
  pendingInvoices = [] as ReturnType<typeof makeInvoiceDoc>[],
}: {
  profiles?: ReturnType<typeof makeActiveProfileDoc>[]
  existingInvoices?: ReturnType<typeof makeInvoiceDoc>[]
  pendingInvoices?: ReturnType<typeof makeInvoiceDoc>[]
} = {}) {
  const newInvoiceSet = vi.fn().mockResolvedValue(undefined)
  const newInvoiceRef = { id: 'new_invoice_id', set: newInvoiceSet }

  // Track which collection path is being queried to return correct docs
  const makeCollectionMock = (path: string) => {
    let _whereField = ''

    const collMock = {
      where: vi.fn().mockImplementation((field: string) => {
        _whereField = field
        return collMock
      }),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(async () => {
        if (path.includes('childBillingProfiles')) {
          return { docs: profiles }
        }
        if (path.includes('invoices')) {
          // If filtering by billingProfileId → idempotency check
          if (_whereField === 'billingProfileId') {
            return { docs: existingInvoices }
          }
          // If filtering by status === 'pending' → overdue check
          if (_whereField === 'status') {
            return { docs: pendingInvoices }
          }
          return { docs: [] }
        }
        return { docs: [] }
      }),
      doc: vi.fn().mockReturnValue(newInvoiceRef),
      add: vi.fn().mockResolvedValue({ id: 'feed_1' }),
    }
    return collMock
  }

  const mockDocUpdate = vi.fn().mockResolvedValue(undefined)
  const mockBatch = {
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  }

  const db = {
    collection: vi.fn().mockImplementation((path: string) => makeCollectionMock(path)),
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false }),
      update: mockDocUpdate,
    }),
    batch: vi.fn().mockReturnValue(mockBatch),
  } as unknown as Firestore

  return { db, newInvoiceRef, newInvoiceSet, mockDocUpdate, mockBatch }
}

// ─── generateMonthlyInvoicesForOrg ───────────────────────────────────────────

describe('generateMonthlyInvoicesForOrg', () => {
  beforeEach(() => vi.clearAllMocks())

  // BDD Scenario 2: Auto-generate monthly invoice
  describe('GIVEN active profile with nextInvoiceDate = today', () => {
    it('THEN result.created === 1', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(1)
      expect(result.skipped).toBe(0)
      expect(result.failed).toBe(0)
    })

    it('THEN invoice doc is created with status pending and billingProfileId set', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db, newInvoiceSet } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(newInvoiceSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'pending',
          billingProfileId: 'profile1',
        })
      )
    })

    it('THEN invoice has periodStart and periodEnd set', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db, newInvoiceSet } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      await generateMonthlyInvoicesForOrg(db, 'org1')

      const setArg = newInvoiceSet.mock.calls[0][0] as Record<string, unknown>
      expect(typeof setArg.periodStart).toBe('string')
      expect(typeof setArg.periodEnd).toBe('string')
    })

    it('THEN profile nextInvoiceDate is advanced to next month', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db, mockDocUpdate } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(mockDocUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          nextInvoiceDate: expect.any(Date),
        })
      )
    })
  })

  // BDD Scenario 3: Idempotency
  describe('GIVEN invoice already exists with same billingProfileId + periodStart', () => {
    it('THEN result.skipped === 1 and result.created === 0', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      // Profile nextInvoiceDate is yesterday — service uses its month for periodStart
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      // Service computes periodStartISO as first day of nextInvoiceDate's month, ISO date-only string
      const periodStartISO = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      const { db } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [
          makeInvoiceDoc({ billingProfileId: 'profile1', periodStart: periodStartISO }),
        ],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.skipped).toBe(1)
      expect(result.created).toBe(0)
    })

    it('THEN no new invoice document is created', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const periodStartISO = new Date(yesterday.getFullYear(), yesterday.getMonth(), 1)
        .toISOString()
        .split('T')[0]
      const { db, newInvoiceSet } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [
          makeInvoiceDoc({ billingProfileId: 'profile1', periodStart: periodStartISO }),
        ],
      })

      await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(newInvoiceSet).not.toHaveBeenCalled()
    })
  })

  // BDD Scenario 7: Paused billing profile skipped
  describe('GIVEN profile has status paused', () => {
    it('THEN result.created === 0 (paused profiles not fetched by active filter)', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      // Paused profiles would not appear in the active-filter query
      const { db } = makeGenerationMockDb({
        profiles: [], // the where('status','==','active') returns nothing
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(0)
    })
  })

  // BDD Scenario 8: Canceled billing profile skipped
  describe('GIVEN profile has status canceled', () => {
    it('THEN result.created === 0 (canceled profiles not fetched by active filter)', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db } = makeGenerationMockDb({
        profiles: [], // canceled profiles excluded by active filter
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(0)
    })
  })

  // BDD Scenario 9: Missing Finik config — invoice created without paymentUrl
  describe('GIVEN getOrgPaymentProvider returns null', () => {
    it('THEN result.created === 1 and invoice is created with paymentUrl = null', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const { db, newInvoiceSet } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(1)
      expect(newInvoiceSet).toHaveBeenCalledWith(
        expect.objectContaining({ paymentUrl: null })
      )
    })
  })

  // Provider error — non-fatal
  describe('GIVEN provider throws an error', () => {
    it('THEN result.created === 1 (invoice still created without paymentUrl)', async () => {
      const errorProvider = {
        name: 'finik',
        createInvoice: vi.fn().mockRejectedValue(new Error('Provider timeout')),
        getPaymentStatus: vi.fn(),
        handleWebhook: vi.fn(),
        cancelInvoice: vi.fn(),
        validateConfig: vi.fn(),
      }
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(errorProvider as never)
      const { db } = makeGenerationMockDb({
        profiles: [makeActiveProfileDoc()],
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(1)
      expect(result.failed).toBe(0)
    })
  })

  // No due profiles
  describe('GIVEN profile.nextInvoiceDate is in the future (tomorrow)', () => {
    it('THEN result.created === 0 and result.skipped === 0', async () => {
      vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)

      const { db } = makeGenerationMockDb({
        // The where query filters by nextInvoiceDate <= now — no profiles match
        profiles: [],
        existingInvoices: [],
      })

      const result = await generateMonthlyInvoicesForOrg(db, 'org1')

      expect(result.created).toBe(0)
      expect(result.skipped).toBe(0)
    })
  })
})

// ─── markOverdueInvoicesForOrg ────────────────────────────────────────────────

describe('markOverdueInvoicesForOrg', () => {
  beforeEach(() => vi.clearAllMocks())

  // BDD Scenario 6: Overdue invoice
  describe('GIVEN pending invoices with dueDate in the past', () => {
    it('THEN result.marked > 0', async () => {
      const { db } = makeGenerationMockDb({
        pendingInvoices: [
          makeInvoiceDoc({ status: 'pending', dueDate: '2024-01-01' }),
        ],
      })

      const result = await markOverdueInvoicesForOrg(db, 'org1', new Date('2025-01-01'))

      expect(result.marked).toBeGreaterThan(0)
    })

    it('THEN db.batch().commit() is called', async () => {
      const { db, mockBatch } = makeGenerationMockDb({
        pendingInvoices: [
          makeInvoiceDoc({ status: 'pending', dueDate: '2024-01-01' }),
        ],
      })

      await markOverdueInvoicesForOrg(db, 'org1', new Date('2025-01-01'))

      expect(mockBatch.commit).toHaveBeenCalled()
    })
  })

  // markOverdueInvoicesForOrg: no pending invoices
  describe('GIVEN no pending invoices exist', () => {
    it('THEN result.marked === 0', async () => {
      const { db } = makeGenerationMockDb({
        pendingInvoices: [],
      })

      const result = await markOverdueInvoicesForOrg(db, 'org1')

      expect(result.marked).toBe(0)
    })
  })

  // markOverdueInvoicesForOrg: invoice not yet past due
  describe('GIVEN pending invoice with dueDate far in the future', () => {
    it('THEN result.marked === 0 (not yet overdue)', async () => {
      const { db } = makeGenerationMockDb({
        pendingInvoices: [
          makeInvoiceDoc({ status: 'pending', dueDate: '2099-12-31' }),
        ],
      })

      // now is today — 2099 is not overdue
      const result = await markOverdueInvoicesForOrg(db, 'org1', new Date())

      expect(result.marked).toBe(0)
    })
  })
})
