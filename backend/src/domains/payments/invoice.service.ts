import admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'
import { getOrgPaymentProvider } from './providers/registry.js'
import type {
  CreateInvoiceInput,
  PaymentStatus,
  InvoiceStatus,
} from './providers/PaymentProvider.interface.js'
import { config } from '../../config/index.js'

export interface InvoiceDoc {
  id: string
  invoiceId: string
  orgId: string
  parentId: string
  childId: string
  amount: number
  currency: 'KGS'
  description: string
  dueDate: string
  status: InvoiceStatus
  providerPaymentId?: string
  paymentUrl?: string
  billingProfileId?: string
  periodStart?: string // 'YYYY-MM-DD'
  periodEnd?: string // 'YYYY-MM-DD'
  provider?: 'finik'
  createdBy: string
  createdAt: Date
  updatedAt: Date
  paidAt?: Date
}

function docToInvoice(
  doc: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot
): InvoiceDoc {
  const d = doc.data()!
  return {
    id: doc.id,
    invoiceId: doc.id,
    orgId: d.orgId,
    parentId: d.parentId,
    childId: d.childId,
    amount: d.amount,
    currency: d.currency,
    description: d.description,
    dueDate: d.dueDate,
    status: d.status,
    providerPaymentId: d.providerPaymentId ?? undefined,
    paymentUrl: d.paymentUrl ?? undefined,
    billingProfileId: d.billingProfileId ?? undefined,
    periodStart: d.periodStart ?? undefined,
    periodEnd: d.periodEnd ?? undefined,
    provider: d.provider ?? undefined,
    createdBy: d.createdBy,
    createdAt: d.createdAt?.toDate() ?? new Date(),
    updatedAt: d.updatedAt?.toDate() ?? new Date(),
    paidAt: d.paidAt?.toDate() ?? undefined,
  }
}

export async function createInvoice(
  db: Firestore,
  orgId: string,
  input: Omit<CreateInvoiceInput, 'invoiceId' | 'callbackUrl' | 'returnUrl' | 'orgId'>,
  createdBy: string
): Promise<InvoiceDoc> {
  const provider = await getOrgPaymentProvider(db, orgId, 'finik')

  if (!provider) {
    throw new Error(
      'Payment provider is not connected. Please configure Finik in organization settings.'
    )
  }

  const invoiceRef = db.collection(`organizations/${orgId}/invoices`).doc()
  const invoiceId = invoiceRef.id

  const backendUrl = config.BACKEND_PUBLIC_URL?.replace(/\/$/, '') ?? 'http://localhost:3101'

  const callbackUrl = `${backendUrl}/webhooks/finik`
  // returnUrl is where Finik redirects the PARENT after payment — must be the mobile deep link
  const returnUrl = `nuroo://invoices/${invoiceId}?status=paid`

  const result = await provider.createInvoice({
    orgId,
    parentId: input.parentId,
    childId: input.childId,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    dueDate: input.dueDate,
    invoiceId,
    callbackUrl,
    returnUrl,
  })

  const now = admin.firestore.FieldValue.serverTimestamp()
  const docData = {
    orgId,
    parentId: input.parentId,
    childId: input.childId,
    amount: input.amount,
    currency: input.currency,
    description: input.description,
    dueDate: input.dueDate,
    status: result.status,
    providerPaymentId: result.providerPaymentId,
    paymentUrl: result.paymentUrl,
    createdBy,
    createdAt: now,
    updatedAt: now,
  }

  await invoiceRef.set(docData)

  // Create activity feed entry best-effort (no childId required in feed call)
  try {
    await db.collection(`children/${input.childId}/activityFeed`).add({
      organizationId: orgId,
      childId: input.childId,
      type: 'system_event',
      visibility: 'parent_visible',
      authorId: createdBy,
      authorRole: 'org_admin',
      authorName: 'System',
      title: 'Invoice created',
      body: `Invoice for ${input.amount} ${input.currency} created.`,
      relatedEntityType: 'child',
      relatedEntityId: invoiceId,
      metadata: { invoiceId, amount: input.amount, currency: input.currency },
      unreadBy: [input.parentId],
      commentCount: 0,
      hasParentComment: false,
      createdAt: now,
      updatedAt: now,
    })
  } catch {
    // best-effort
  }

  const snap = await invoiceRef.get()
  return docToInvoice(snap)
}

export async function listInvoices(
  db: Firestore,
  orgId: string,
  filters?: { parentId?: string; status?: InvoiceStatus; limit?: number; month?: string }
): Promise<InvoiceDoc[]> {
  const limit = Math.min(filters?.limit ?? 50, 200)

  // Avoid compound query (where + orderBy on different fields) which requires a
  // composite Firestore index. Instead, apply only the single-field orderBy and
  // filter parentId/month in-memory. At startup scale the subcollection is small enough
  // that fetching a bounded extra page is negligible.
  let q = db
    .collection(`organizations/${orgId}/invoices`)
    .orderBy('createdAt', 'desc') as admin.firestore.Query

  if (filters?.status) {
    // status equality + orderBy('createdAt') requires only the default single-field
    // index on createdAt — no composite index needed when status is the sole filter.
    q = q.where('status', '==', filters.status)
  }

  // Fetch a larger page so in-memory filtering still returns `limit` docs
  const needsInMemoryFilter = filters?.parentId || filters?.month
  const fetchLimit = needsInMemoryFilter ? limit * 4 : limit
  const snap = await q.limit(Math.min(fetchLimit, 800)).get()
  let docs = snap.docs.map(docToInvoice)

  if (filters?.parentId) {
    docs = docs.filter((d) => d.parentId === filters.parentId)
  }

  // Filter by month: dueDate starts with 'YYYY-MM'
  if (filters?.month) {
    docs = docs.filter((d) => d.dueDate?.startsWith(filters.month!))
  }

  return docs.slice(0, limit)
}

export async function getInvoice(
  db: Firestore,
  orgId: string,
  invoiceId: string
): Promise<InvoiceDoc | null> {
  const snap = await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).get()
  if (!snap.exists) return null
  const invoice = docToInvoice(snap)
  if (invoice.orgId !== orgId) return null
  return invoice
}

export async function cancelInvoice(
  db: Firestore,
  orgId: string,
  invoiceId: string
): Promise<InvoiceDoc> {
  const invoice = await getInvoice(db, orgId, invoiceId)
  if (!invoice) {
    throw new Error('Invoice not found')
  }
  if (!['pending', 'upcoming', 'overdue'].includes(invoice.status)) {
    throw new Error(`Cannot cancel invoice with status: ${invoice.status}`)
  }

  const provider = await getOrgPaymentProvider(db, orgId, 'finik')
  if (provider && invoice.providerPaymentId) {
    try {
      await provider.cancelInvoice(invoice.providerPaymentId)
    } catch {
      // best-effort: still mark as canceled locally
    }
  }

  const now = admin.firestore.FieldValue.serverTimestamp()
  await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).update({
    status: 'canceled',
    updatedAt: now,
  })

  const snap = await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).get()
  return docToInvoice(snap)
}

export async function updateInvoiceStatus(
  db: Firestore,
  orgId: string,
  invoiceId: string,
  status: PaymentStatus,
  paidAt?: Date
): Promise<InvoiceDoc> {
  // Verify existence before updating to avoid unhandled NOT_FOUND throws from webhooks
  const existing = await getInvoice(db, orgId, invoiceId)
  if (!existing) {
    throw new Error('Invoice not found')
  }

  const now = admin.firestore.FieldValue.serverTimestamp()
  const updates: Record<string, unknown> = {
    status,
    updatedAt: now,
  }

  if (status === 'paid') {
    // Default to server time if caller does not supply paidAt
    updates.paidAt = paidAt ?? new Date()
  }

  await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).update(updates)

  if (status === 'paid') {
    // best-effort activity event
    try {
      const invoiceSnap = await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).get()
      const invData = invoiceSnap.data()
      if (invData?.childId) {
        await db.collection(`children/${invData.childId}/activityFeed`).add({
          organizationId: orgId,
          childId: invData.childId,
          type: 'system_event',
          visibility: 'parent_visible',
          authorId: 'system',
          authorRole: 'system',
          authorName: 'System',
          title: 'Payment received',
          body: `Invoice payment of ${invData.amount} ${invData.currency} received.`,
          relatedEntityType: 'child',
          relatedEntityId: invoiceId,
          metadata: { invoiceId, status },
          unreadBy: [],
          commentCount: 0,
          hasParentComment: false,
          createdAt: now,
          updatedAt: now,
        })
      }
    } catch {
      // best-effort
    }
  }

  const snap = await db.doc(`organizations/${orgId}/invoices/${invoiceId}`).get()
  return docToInvoice(snap)
}
