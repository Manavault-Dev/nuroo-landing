import admin from 'firebase-admin'
import type { Firestore } from 'firebase-admin/firestore'

export interface ChildBillingProfile {
  id: string
  orgId: string
  childId: string
  parentId: string
  amount: number
  currency: 'KGS'
  billingCycle: 'monthly'
  dueDayOfMonth: number // 1-28
  status: 'active' | 'paused' | 'canceled'
  provider: 'finik'
  nextInvoiceDate: Date
  note?: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// Calculate next invoice due date from a given "from" date.
// If the due day in the current month is >= fromDate, return that date.
// Otherwise return next month's due day.
// dueDayOfMonth is clamped to max 28 at creation.
export function calculateNextInvoiceDate(dueDayOfMonth: number, fromDate = new Date()): Date {
  const year = fromDate.getFullYear()
  const month = fromDate.getMonth()
  const thisMonthDue = new Date(year, month, dueDayOfMonth)
  if (thisMonthDue >= fromDate) return thisMonthDue
  return new Date(year, month + 1, dueDayOfMonth)
}

// Advance nextInvoiceDate by exactly one month (same day)
export function advanceNextInvoiceDate(current: Date, dueDayOfMonth: number): Date {
  return new Date(current.getFullYear(), current.getMonth() + 1, dueDayOfMonth)
}

function docToProfile(
  doc: admin.firestore.DocumentSnapshot | admin.firestore.QueryDocumentSnapshot
): ChildBillingProfile {
  const d = doc.data()!
  return {
    id: doc.id,
    orgId: d.orgId,
    childId: d.childId,
    parentId: d.parentId,
    amount: d.amount,
    currency: d.currency,
    billingCycle: d.billingCycle,
    dueDayOfMonth: d.dueDayOfMonth,
    status: d.status,
    provider: d.provider,
    nextInvoiceDate: d.nextInvoiceDate?.toDate() ?? new Date(),
    note: d.note ?? undefined,
    createdBy: d.createdBy,
    createdAt: d.createdAt?.toDate() ?? new Date(),
    updatedAt: d.updatedAt?.toDate() ?? new Date(),
  }
}

export async function createBillingProfile(
  db: Firestore,
  orgId: string,
  input: {
    childId: string
    parentId: string
    amount: number
    currency: 'KGS'
    billingCycle: 'monthly'
    dueDayOfMonth: number
    note?: string
  },
  createdBy: string
): Promise<ChildBillingProfile> {
  // Guard: prevent duplicate active/paused billing profile for the same child
  const existingSnap = await db
    .collection(`organizations/${orgId}/childBillingProfiles`)
    .where('childId', '==', input.childId)
    .where('status', 'in', ['active', 'paused'])
    .limit(1)
    .get()
  if (!existingSnap.empty) {
    throw new Error('DUPLICATE_BILLING_PROFILE')
  }

  const nextInvoiceDate = calculateNextInvoiceDate(input.dueDayOfMonth)
  const now = admin.firestore.FieldValue.serverTimestamp()
  const ref = db.collection(`organizations/${orgId}/childBillingProfiles`).doc()
  await ref.set({
    orgId,
    childId: input.childId,
    parentId: input.parentId,
    amount: input.amount,
    currency: input.currency,
    billingCycle: input.billingCycle,
    dueDayOfMonth: input.dueDayOfMonth,
    status: 'active',
    provider: 'finik',
    nextInvoiceDate,
    note: input.note ?? null,
    createdBy,
    createdAt: now,
    updatedAt: now,
  })
  const snap = await ref.get()
  return docToProfile(snap)
}

export async function getBillingProfile(
  db: Firestore,
  orgId: string,
  profileId: string
): Promise<ChildBillingProfile | null> {
  const snap = await db.doc(`organizations/${orgId}/childBillingProfiles/${profileId}`).get()
  if (!snap.exists) return null
  const profile = docToProfile(snap)
  // Cross-check orgId to prevent IDOR (consistent with getInvoice pattern)
  if (profile.orgId !== orgId) return null
  return profile
}

export async function listBillingProfiles(
  db: Firestore,
  orgId: string,
  filters?: { childId?: string; status?: ChildBillingProfile['status'] }
): Promise<ChildBillingProfile[]> {
  // Use single-field queries only to avoid composite index requirement.
  // Filter in-memory for additional fields.
  let q = db.collection(`organizations/${orgId}/childBillingProfiles`) as admin.firestore.Query
  if (filters?.status) {
    q = q.where('status', '==', filters.status)
  }
  const snap = await q.get()
  let profiles = snap.docs.map(docToProfile)
  if (filters?.childId) {
    profiles = profiles.filter((p) => p.childId === filters.childId)
  }
  // Sort by createdAt desc in-memory
  profiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  return profiles
}

export async function updateBillingProfile(
  db: Firestore,
  orgId: string,
  profileId: string,
  updates: Partial<Pick<ChildBillingProfile, 'amount' | 'dueDayOfMonth' | 'status' | 'note'>>
): Promise<ChildBillingProfile> {
  const existing = await getBillingProfile(db, orgId, profileId)
  if (!existing) throw new Error('Billing profile not found')

  const now = admin.firestore.FieldValue.serverTimestamp()
  const patch: Record<string, unknown> = { updatedAt: now }

  if (updates.amount !== undefined) patch.amount = updates.amount
  if (updates.status !== undefined) patch.status = updates.status
  if (updates.note !== undefined) patch.note = updates.note ?? null
  if (updates.dueDayOfMonth !== undefined) {
    patch.dueDayOfMonth = updates.dueDayOfMonth
    // Recalculate nextInvoiceDate with new due day
    patch.nextInvoiceDate = calculateNextInvoiceDate(updates.dueDayOfMonth)
  }

  await db.doc(`organizations/${orgId}/childBillingProfiles/${profileId}`).update(patch)
  const snap = await db.doc(`organizations/${orgId}/childBillingProfiles/${profileId}`).get()
  return docToProfile(snap)
}
