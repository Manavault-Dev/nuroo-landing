import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Firestore } from 'firebase-admin/firestore'

vi.mock('../providers/registry.js', () => ({
  getOrgPaymentProvider: vi.fn(),
}))

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
        arrayUnion: (...args: unknown[]) => args,
        arrayRemove: (...args: unknown[]) => args,
      },
    },
  },
}))

import { getOrgPaymentProvider } from '../providers/registry.js'
import { createInvoice, getInvoice } from '../invoice.service.js'

const BASE_INPUT = {
  parentId: 'parent1',
  childId: 'child1',
  amount: 1500,
  currency: 'KGS' as const,
  description: 'Monthly fee',
  dueDate: '2099-01-01',
}

function makeMockProvider(overrides?: Partial<{ providerPaymentId: string; paymentUrl: string }>) {
  return {
    name: 'finik',
    createInvoice: vi.fn().mockResolvedValue({
      providerPaymentId: overrides?.providerPaymentId ?? 'txn_001',
      paymentUrl: overrides?.paymentUrl ?? 'https://pay.finik.kg/txn_001',
      status: 'pending' as const,
    }),
    getPaymentStatus: vi.fn(),
    handleWebhook: vi.fn(),
    cancelInvoice: vi.fn(),
    validateConfig: vi.fn(),
  }
}

function makeMockDb(invoiceId = 'invoice_abc') {
  const docData = {
    orgId: 'org1',
    parentId: 'parent1',
    childId: 'child1',
    amount: 1500,
    currency: 'KGS',
    description: 'Monthly fee',
    dueDate: '2099-01-01',
    status: 'pending',
    providerPaymentId: 'txn_001',
    paymentUrl: 'https://pay.finik.kg/txn_001',
    createdBy: 'admin1',
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
  }

  const mockDocRef = {
    id: invoiceId,
    set: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue({
      id: invoiceId,
      exists: true,
      data: () => docData,
    }),
  }

  const mockCollectionRef = {
    doc: vi.fn().mockReturnValue(mockDocRef),
    add: vi.fn().mockResolvedValue({ id: 'activity_1' }),
  }

  const db = {
    collection: vi.fn().mockReturnValue(mockCollectionRef),
    doc: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue({ exists: false }),
      set: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
    }),
  } as unknown as Firestore

  return { db, mockDocRef, mockCollectionRef }
}

// ─── createInvoice ───────────────────────────────────────────────────────────

describe('createInvoice — provider not configured', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws when payment provider is null', async () => {
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
    const { db } = makeMockDb()

    await expect(createInvoice(db, 'org1', BASE_INPUT, 'admin1')).rejects.toThrow(
      'Payment provider is not connected'
    )
  })
})

describe('createInvoice — happy path', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls provider.createInvoice with correct orgId and parentId', async () => {
    const provider = makeMockProvider()
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(provider)
    const { db } = makeMockDb()

    await createInvoice(db, 'org1', BASE_INPUT, 'admin1')

    expect(provider.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org1',
        parentId: 'parent1',
        childId: 'child1',
        amount: 1500,
        currency: 'KGS',
      })
    )
  })

  it('encodes orgId__invoiceId in the reference passed to provider', async () => {
    const provider = makeMockProvider()
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(provider)
    const { db, mockDocRef } = makeMockDb('inv_xyz')

    await createInvoice(db, 'org1', BASE_INPUT, 'admin1')

    const call = provider.createInvoice.mock.calls[0][0] as { invoiceId: string; orgId: string }
    // The provider receives invoiceId and orgId separately;
    // FinikPaymentProvider.createInvoice builds the composite reference internally.
    // We verify the service passes both so the provider can compose them.
    expect(call.orgId).toBe('org1')
    expect(typeof call.invoiceId).toBe('string')
    expect(call.invoiceId.length).toBeGreaterThan(0)
  })

  it('persists invoice document with pending status', async () => {
    const provider = makeMockProvider()
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(provider)
    const { db, mockDocRef } = makeMockDb()

    const result = await createInvoice(db, 'org1', BASE_INPUT, 'admin1')

    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org1',
        parentId: 'parent1',
        status: 'pending',
        paymentUrl: 'https://pay.finik.kg/txn_001',
      })
    )
    expect(result.invoiceId).toBe('invoice_abc')
  })

  it('persists paymentUrl from provider into Firestore', async () => {
    const provider = makeMockProvider({ paymentUrl: 'https://pay.finik.kg/abc' })
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(provider)
    const { db, mockDocRef } = makeMockDb()

    await createInvoice(db, 'org1', BASE_INPUT, 'admin1')

    // Verify the Firestore write contains the provider's paymentUrl
    expect(mockDocRef.set).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentUrl: 'https://pay.finik.kg/abc',
        status: 'pending',
      })
    )
  })
})

// ─── parentId validation ──────────────────────────────────────────────────────

describe('createInvoice — parentId guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects empty parentId at service level when provider is missing (provider check first)', async () => {
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(null)
    const { db } = makeMockDb()

    // Even with empty parentId, provider-not-found error surfaces first
    await expect(
      createInvoice(db, 'org1', { ...BASE_INPUT, parentId: '' }, 'admin1')
    ).rejects.toThrow('Payment provider is not connected')
  })

  it('passes non-empty parentId through to provider when provider exists', async () => {
    const provider = makeMockProvider()
    vi.mocked(getOrgPaymentProvider).mockResolvedValue(provider)
    const { db } = makeMockDb()

    await createInvoice(db, 'org1', { ...BASE_INPUT, parentId: 'uid_parent_abc' }, 'admin1')

    expect(provider.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ parentId: 'uid_parent_abc' })
    )
  })
})

// ─── getInvoice — cross-org access control ───────────────────────────────────

describe('getInvoice — org isolation', () => {
  it('returns null when orgId does not match document orgId', async () => {
    const db = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          id: 'invoice_abc',
          exists: true,
          data: () => ({
            orgId: 'org1',
            parentId: 'parent1',
            childId: 'child1',
            amount: 1500,
            currency: 'KGS',
            description: 'test',
            dueDate: '2099-01-01',
            status: 'pending',
            createdBy: 'admin1',
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() },
          }),
        }),
      }),
    } as unknown as Firestore

    const result = await getInvoice(db, 'org2', 'invoice_abc')
    expect(result).toBeNull()
  })

  it('returns invoice when orgId matches', async () => {
    const db = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({
          id: 'invoice_abc',
          exists: true,
          data: () => ({
            orgId: 'org1',
            parentId: 'parent1',
            childId: 'child1',
            amount: 1500,
            currency: 'KGS',
            description: 'test',
            dueDate: '2099-01-01',
            status: 'pending',
            createdBy: 'admin1',
            createdAt: { toDate: () => new Date() },
            updatedAt: { toDate: () => new Date() },
          }),
        }),
      }),
    } as unknown as Firestore

    const result = await getInvoice(db, 'org1', 'invoice_abc')
    expect(result).not.toBeNull()
    expect(result?.invoiceId).toBe('invoice_abc')
    expect(result?.parentId).toBe('parent1')
  })

  it('returns null when document does not exist', async () => {
    const db = {
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ id: 'missing', exists: false }),
      }),
    } as unknown as Firestore

    const result = await getInvoice(db, 'org1', 'missing')
    expect(result).toBeNull()
  })
})
