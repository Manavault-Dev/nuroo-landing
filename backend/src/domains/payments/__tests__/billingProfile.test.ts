import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

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
      Query: class {},
    },
  },
}))

import {
  calculateNextInvoiceDate,
  advanceNextInvoiceDate,
  createBillingProfile,
  getBillingProfile,
  listBillingProfiles,
  updateBillingProfile,
} from '../billingProfile.service.js'

// ─── Mock DB factory ──────────────────────────────────────────────────────────

function makeBillingProfileMockDb(profileId = 'profile_abc') {
  const docData = {
    orgId: 'org1',
    childId: 'child1',
    parentId: 'parent1',
    amount: 4000,
    currency: 'KGS',
    billingCycle: 'monthly',
    dueDayOfMonth: 5,
    status: 'active',
    provider: 'finik',
    nextInvoiceDate: { toDate: () => new Date(2025, 5, 5) }, // June 5 2025
    createdBy: 'admin1',
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
  }

  const mockDocRef = {
    id: profileId,
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({
      id: profileId,
      exists: true,
      data: () => docData,
    }),
    update: vi.fn().mockResolvedValue(undefined),
  }

  const mockCollRef = {
    doc: vi.fn().mockReturnValue(mockDocRef),
    where: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      docs: [{ id: profileId, data: () => docData }],
    }),
  }

  const db = {
    collection: vi.fn().mockReturnValue(mockCollRef),
    doc: vi.fn().mockReturnValue(mockDocRef),
  } as unknown as Firestore

  return { db, mockDocRef, mockCollRef, docData }
}

// ─── calculateNextInvoiceDate ────────────────────────────────────────────────

describe('calculateNextInvoiceDate', () => {
  it('returns Jan 5 when today is Jan 1 and due day is 5', () => {
    const fromDate = new Date(2025, 0, 1) // Jan 1 2025
    const result = calculateNextInvoiceDate(5, fromDate)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(5)
  })

  it('returns Feb 5 when today is Jan 6 and due day is 5 (this month already passed)', () => {
    const fromDate = new Date(2025, 0, 6) // Jan 6 2025
    const result = calculateNextInvoiceDate(5, fromDate)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(5)
  })

  it('returns the same day when today IS the due day (Jan 5, due day 5)', () => {
    const fromDate = new Date(2025, 0, 5) // Jan 5 2025
    const result = calculateNextInvoiceDate(5, fromDate)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(5)
  })

  it('returns next month 28th when today is any date after 28th and due day is 28', () => {
    const fromDate = new Date(2025, 0, 29) // Jan 29 2025
    const result = calculateNextInvoiceDate(28, fromDate)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(28)
  })
})

// ─── advanceNextInvoiceDate ──────────────────────────────────────────────────

describe('advanceNextInvoiceDate', () => {
  it('advances Jan 5 2025 to Feb 5 2025', () => {
    const current = new Date(2025, 0, 5) // Jan 5 2025
    const result = advanceNextInvoiceDate(current, 5)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(5)
  })

  it('advances Dec 5 2025 to Jan 5 2026 (year rollover)', () => {
    const current = new Date(2025, 11, 5) // Dec 5 2025
    const result = advanceNextInvoiceDate(current, 5)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(0) // January
    expect(result.getDate()).toBe(5)
  })

  it('advances Jan 28 to Feb 28 with due day 28', () => {
    const current = new Date(2025, 0, 28) // Jan 28 2025
    const result = advanceNextInvoiceDate(current, 28)
    expect(result.getFullYear()).toBe(2025)
    expect(result.getMonth()).toBe(1) // February
    expect(result.getDate()).toBe(28)
  })
})

// ─── createBillingProfile ────────────────────────────────────────────────────

describe('createBillingProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  const BASE_INPUT = {
    childId: 'child1',
    parentId: 'parent1',
    amount: 4000,
    currency: 'KGS' as const,
    billingCycle: 'monthly' as const,
    dueDayOfMonth: 5,
  }

  it('persists profile document with status active', async () => {
    const { db, mockDocRef } = makeBillingProfileMockDb()

    await createBillingProfile(db, 'org1', BASE_INPUT, 'admin1')

    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', orgId: 'org1' })
    )
  })

  it('calculates nextInvoiceDate using calculateNextInvoiceDate', async () => {
    const { db, mockDocRef } = makeBillingProfileMockDb()

    await createBillingProfile(db, 'org1', BASE_INPUT, 'admin1')

    const setArg = mockDocRef.set.mock.calls[0][0] as Record<string, unknown>
    expect(setArg.nextInvoiceDate).toBeInstanceOf(Date)
  })

  it('sets billingCycle to monthly', async () => {
    const { db, mockDocRef } = makeBillingProfileMockDb()

    await createBillingProfile(db, 'org1', BASE_INPUT, 'admin1')

    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: 'monthly' })
    )
  })

  it('returns profile with the generated id', async () => {
    const { db } = makeBillingProfileMockDb('profile_abc')

    const result = await createBillingProfile(db, 'org1', BASE_INPUT, 'admin1')

    expect(result.id).toBe('profile_abc')
  })

  it('sets provider to finik', async () => {
    const { db, mockDocRef } = makeBillingProfileMockDb()

    await createBillingProfile(db, 'org1', BASE_INPUT, 'admin1')

    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'finik' })
    )
  })
})

// ─── getBillingProfile ───────────────────────────────────────────────────────

describe('getBillingProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when document does not exist', async () => {
    const db = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
      }),
    } as unknown as Firestore

    const result = await getBillingProfile(db, 'org1', 'nonexistent')
    expect(result).toBeNull()
  })

  it('returns profile when document exists', async () => {
    const { db } = makeBillingProfileMockDb('profile_abc')

    const result = await getBillingProfile(db, 'org1', 'profile_abc')

    expect(result).not.toBeNull()
    expect(result?.id).toBe('profile_abc')
  })

  it('returns profile with correct fields', async () => {
    const { db } = makeBillingProfileMockDb('profile_abc')

    const result = await getBillingProfile(db, 'org1', 'profile_abc')

    expect(result?.orgId).toBe('org1')
    expect(result?.childId).toBe('child1')
    expect(result?.parentId).toBe('parent1')
    expect(result?.amount).toBe(4000)
    expect(result?.currency).toBe('KGS')
    expect(result?.billingCycle).toBe('monthly')
    expect(result?.status).toBe('active')
    expect(result?.provider).toBe('finik')
    expect(result?.nextInvoiceDate).toBeInstanceOf(Date)
  })
})

// ─── listBillingProfiles ─────────────────────────────────────────────────────

describe('listBillingProfiles', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeListMockDb(profiles: Array<{ id: string; data: Record<string, unknown> }>) {
    const mockQuery = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: profiles.map((p) => ({
          id: p.id,
          data: () => p.data,
        })),
      }),
    }
    const db = {
      collection: vi.fn().mockReturnValue(mockQuery),
    } as unknown as Firestore
    return { db, mockQuery }
  }

  const makeProfileData = (overrides: Partial<Record<string, unknown>> = {}) => ({
    orgId: 'org1',
    childId: 'child1',
    parentId: 'parent1',
    amount: 4000,
    currency: 'KGS',
    billingCycle: 'monthly',
    dueDayOfMonth: 5,
    status: 'active',
    provider: 'finik',
    nextInvoiceDate: { toDate: () => new Date(2025, 5, 5) },
    createdBy: 'admin1',
    createdAt: { toDate: () => new Date(2025, 0, 1) },
    updatedAt: { toDate: () => new Date(2025, 0, 1) },
    ...overrides,
  })

  it('returns all profiles when no filters provided', async () => {
    const { db } = makeListMockDb([
      { id: 'p1', data: makeProfileData() },
      { id: 'p2', data: makeProfileData({ childId: 'child2' }) },
    ])

    const result = await listBillingProfiles(db, 'org1')

    expect(result).toHaveLength(2)
  })

  it('filters by childId in-memory', async () => {
    const { db } = makeListMockDb([
      { id: 'p1', data: makeProfileData({ childId: 'child1' }) },
      { id: 'p2', data: makeProfileData({ childId: 'child2' }) },
      { id: 'p3', data: makeProfileData({ childId: 'child1' }) },
    ])

    const result = await listBillingProfiles(db, 'org1', { childId: 'child1' })

    expect(result).toHaveLength(2)
    expect(result.every((p) => p.childId === 'child1')).toBe(true)
  })

  it('returns empty array when no profiles match', async () => {
    const { db } = makeListMockDb([
      { id: 'p1', data: makeProfileData({ childId: 'child2' }) },
    ])

    const result = await listBillingProfiles(db, 'org1', { childId: 'child1' })

    expect(result).toHaveLength(0)
  })

  it('applies status filter via Firestore query', async () => {
    const { db, mockQuery } = makeListMockDb([
      { id: 'p1', data: makeProfileData({ status: 'active' }) },
    ])

    await listBillingProfiles(db, 'org1', { status: 'active' })

    expect(mockQuery.where).toHaveBeenCalledWith('status', '==', 'active')
  })
})

// ─── updateBillingProfile ────────────────────────────────────────────────────

describe('updateBillingProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it("throws 'Billing profile not found' when profile does not exist", async () => {
    const db = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ exists: false }),
        update: vi.fn().mockResolvedValue(undefined),
      }),
    } as unknown as Firestore

    await expect(
      updateBillingProfile(db, 'org1', 'nonexistent', { amount: 5000 })
    ).rejects.toThrow('Billing profile not found')
  })

  it('updates amount when provided', async () => {
    const { db, mockDocRef, docData } = makeBillingProfileMockDb('profile_abc')
    // Second get (after update) returns updated amount
    mockDocRef.get
      .mockResolvedValueOnce({ id: 'profile_abc', exists: true, data: () => docData })
      .mockResolvedValueOnce({
        id: 'profile_abc',
        exists: true,
        data: () => ({ ...docData, amount: 5000 }),
      })

    const result = await updateBillingProfile(db, 'org1', 'profile_abc', { amount: 5000 })

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 })
    )
    expect(result.amount).toBe(5000)
  })

  it("updates status to 'paused'", async () => {
    const { db, mockDocRef, docData } = makeBillingProfileMockDb('profile_abc')
    mockDocRef.get
      .mockResolvedValueOnce({ id: 'profile_abc', exists: true, data: () => docData })
      .mockResolvedValueOnce({
        id: 'profile_abc',
        exists: true,
        data: () => ({ ...docData, status: 'paused' }),
      })

    const result = await updateBillingProfile(db, 'org1', 'profile_abc', { status: 'paused' })

    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'paused' })
    )
    expect(result.status).toBe('paused')
  })

  it('recalculates nextInvoiceDate when dueDayOfMonth changes', async () => {
    const { db, mockDocRef, docData } = makeBillingProfileMockDb('profile_abc')
    const newDueDay = 15
    mockDocRef.get
      .mockResolvedValueOnce({ id: 'profile_abc', exists: true, data: () => docData })
      .mockResolvedValueOnce({
        id: 'profile_abc',
        exists: true,
        data: () => ({
          ...docData,
          dueDayOfMonth: newDueDay,
          nextInvoiceDate: { toDate: () => new Date(2025, 5, newDueDay) },
        }),
      })

    await updateBillingProfile(db, 'org1', 'profile_abc', { dueDayOfMonth: newDueDay })

    const updateArg = mockDocRef.update.mock.calls[0][0] as Record<string, unknown>
    expect(updateArg.dueDayOfMonth).toBe(newDueDay)
    expect(updateArg.nextInvoiceDate).toBeInstanceOf(Date)
  })

  it('does not change fields not included in updates', async () => {
    const { db, mockDocRef, docData } = makeBillingProfileMockDb('profile_abc')
    mockDocRef.get
      .mockResolvedValueOnce({ id: 'profile_abc', exists: true, data: () => docData })
      .mockResolvedValueOnce({ id: 'profile_abc', exists: true, data: () => docData })

    await updateBillingProfile(db, 'org1', 'profile_abc', { amount: 5000 })

    const updateArg = mockDocRef.update.mock.calls[0][0] as Record<string, unknown>
    // Should not contain status, dueDayOfMonth, or note if not passed
    expect(updateArg).not.toHaveProperty('status')
    expect(updateArg).not.toHaveProperty('dueDayOfMonth')
  })
})
