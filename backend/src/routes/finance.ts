import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'

const ORG_CHILDREN = (orgId: string) => `organizations/${orgId}/children`
const ORG_ATTENDANCE = (orgId: string) => `organizations/${orgId}/attendance`
const ORG_MONTHLY_FEES = (orgId: string) => `organizations/${orgId}/monthlyFees`

const attendanceSchema = z.object({
  childId: z.string().min(1),
  childName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['present', 'absent', 'late']),
  note: z.string().max(500).optional(),
})

const feeSchema = z.object({
  childId: z.string().min(1),
  childName: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number().min(0),
  status: z.enum(['paid', 'pending', 'overdue']),
  note: z.string().max(500).optional(),
})

async function resolveChildName(
  db: FirebaseFirestore.Firestore,
  childId: string,
  parentUserId?: string
): Promise<string> {
  try {
    const childDoc = await db.doc(`children/${childId}`).get()
    if (childDoc.exists) {
      const d = childDoc.data()!
      const name = d.name || d.childName || d.displayName || d.fullName
      if (name && name !== 'Unknown') return name
    }
  } catch {
    // Ignore lookup errors and continue with fallback sources.
  }

  try {
    const userDoc = await db.doc(`users/${childId}`).get()
    if (userDoc.exists) {
      const d = userDoc.data()!
      const name = d.name || d.childName || d.displayName
      if (name && name !== 'Unknown') return name
    }
  } catch {
    // Ignore lookup errors and continue with fallback sources.
  }

  // Try parentUserId in users collection (mobile app stores child info under parent's doc)
  if (parentUserId && parentUserId !== childId) {
    try {
      const parentDoc = await db.doc(`users/${parentUserId}`).get()
      if (parentDoc.exists) {
        const d = parentDoc.data()!
        const name = d.childName || d.name
        if (name && name !== 'Unknown') return name
      }
    } catch {
      // Ignore lookup errors.
    }
  }

  // Firebase Auth fallback — try childId first, then parentUserId
  for (const uid of [childId, parentUserId].filter(Boolean) as string[]) {
    try {
      const authUser = await admin.auth().getUser(uid)
      if (authUser.displayName) return authUser.displayName
      if (authUser.email) return authUser.email.split('@')[0]
    } catch {
      // User not found in Auth, try next.
    }
  }

  return 'Ребёнок'
}

function computeBillingMeta(
  assignedAt: FirebaseFirestore.Timestamp | null | undefined,
  month: string,
  status: string
) {
  const today = new Date()
  const [year, mon] = month.split('-').map(Number)

  const billingDay = assignedAt ? assignedAt.toDate().getDate() : 1

  const dueDate = new Date(year, mon - 1, billingDay)
  const diffMs = dueDate.getTime() - today.getTime()
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

  let billingStatus: 'paid' | 'overdue' | 'due_soon' | 'upcoming'
  if (status === 'paid') {
    billingStatus = 'paid'
  } else if (daysUntilDue < 0) {
    billingStatus = 'overdue'
  } else if (daysUntilDue <= 3) {
    billingStatus = 'due_soon'
  } else {
    billingStatus = 'upcoming'
  }

  return {
    billingDay,
    dueDate: dueDate.toISOString().split('T')[0],
    daysUntilDue,
    billingStatus,
  }
}

export const financeRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string }; Querystring: { date?: string } }>(
    '/orgs/:orgId/attendance',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)

        const date = (request.query as any).date || new Date().toISOString().split('T')[0]

        const db = getFirestore()

        const childrenSnap = await db.collection(ORG_CHILDREN(orgId)).get()
        const children = await Promise.all(
          childrenSnap.docs.map(async (doc) => {
            const data = doc.data()
            const rawName = data.childName || data.name
            const name =
              rawName && rawName !== 'Unknown'
                ? rawName
                : await resolveChildName(db, doc.id, data.parentUserId)
            return { id: doc.id, name }
          })
        )

        const attendanceSnap = await db
          .collection(ORG_ATTENDANCE(orgId))
          .where('date', '==', date)
          .get()

        const attendanceMap = new Map<string, any>()
        for (const doc of attendanceSnap.docs) {
          const data = doc.data()
          attendanceMap.set(data.childId, {
            status: data.status,
            note: data.note || null,
            markedAt: data.markedAt?.toDate?.()?.toISOString() || null,
          })
        }

        const records = children.map((child) => {
          const att = attendanceMap.get(child.id)
          return {
            childId: child.id,
            childName: child.name,
            status: att?.status || null,
            note: att?.note || null,
            markedAt: att?.markedAt || null,
          }
        })

        records.sort((a, b) => {
          if (a.status && !b.status) return -1
          if (!a.status && b.status) return 1
          return a.childName.localeCompare(b.childName)
        })

        return { ok: true, date, records }
      } catch (error: any) {
        console.error('[FINANCE] Error getting attendance:', error)
        return reply.code(500).send({ error: 'Failed to get attendance', details: error.message })
      }
    }
  )

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof attendanceSchema> }>(
    '/orgs/:orgId/attendance',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)
        const markedBy = request.user?.uid ?? 'unknown'

        const body = attendanceSchema.parse(request.body)
        const now = new Date()
        const db = getFirestore()

        const docId = `${body.date}_${body.childId}`
        const ref = db.doc(`${ORG_ATTENDANCE(orgId)}/${docId}`)

        await ref.set(
          {
            childId: body.childId,
            childName: body.childName,
            date: body.date,
            status: body.status,
            note: body.note || null,
            markedBy,
            markedAt: admin.firestore.Timestamp.fromDate(now),
          },
          { merge: true }
        )

        return { ok: true, message: 'Attendance recorded' }
      } catch (error: any) {
        console.error('[FINANCE] Error saving attendance:', error)
        return reply.code(500).send({ error: 'Failed to save attendance', details: error.message })
      }
    }
  )

  fastify.get<{ Params: { orgId: string }; Querystring: { month?: string } }>(
    '/orgs/:orgId/finance',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)

        const now = new Date()
        const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const month = (request.query as any).month || defaultMonth

        const db = getFirestore()

        const childrenSnap = await db.collection(ORG_CHILDREN(orgId)).get()
        const children = await Promise.all(
          childrenSnap.docs.map(async (doc) => {
            const data = doc.data()
            const rawName = data.childName || data.name
            const name =
              rawName && rawName !== 'Unknown'
                ? rawName
                : await resolveChildName(db, doc.id, data.parentUserId)
            return { id: doc.id, name, assignedAt: data.assignedAt || null }
          })
        )

        const feesSnap = await db
          .collection(ORG_MONTHLY_FEES(orgId))
          .where('month', '==', month)
          .get()

        const feeMap = new Map<string, any>()
        for (const doc of feesSnap.docs) {
          const data = doc.data()
          feeMap.set(data.childId, {
            amount: data.amount,
            currency: data.currency || 'KGS',
            status: data.status,
            paidAt: data.paidAt?.toDate?.()?.toISOString() || null,
            note: data.note || null,
          })
        }

        const records = children.map((child) => {
          const fee = feeMap.get(child.id)
          const status = fee?.status || 'pending'
          const billing = computeBillingMeta(child.assignedAt, month, status)
          return {
            childId: child.id,
            childName: child.name,
            amount: fee?.amount ?? 0,
            currency: fee?.currency || 'KGS',
            status,
            paidAt: fee?.paidAt || null,
            note: fee?.note || null,
            billingDay: billing.billingDay,
            dueDate: billing.dueDate,
            daysUntilDue: billing.daysUntilDue,
            billingStatus: billing.billingStatus,
          }
        })

        records.sort((a, b) => a.childName.localeCompare(b.childName))

        return { ok: true, month, records }
      } catch (error: any) {
        console.error('[FINANCE] Error getting fees:', error)
        return reply.code(500).send({ error: 'Failed to get fees', details: error.message })
      }
    }
  )

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof feeSchema> }>(
    '/orgs/:orgId/finance',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const member = await requireOrgMember(request, reply, orgId)

        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only org admins can record fees' })
        }

        const body = feeSchema.parse(request.body)
        const now = new Date()
        const db = getFirestore()

        const docId = `${body.month}_${body.childId}`
        const ref = db.doc(`${ORG_MONTHLY_FEES(orgId)}/${docId}`)

        const feeData: any = {
          childId: body.childId,
          childName: body.childName,
          month: body.month,
          amount: body.amount,
          currency: 'KGS',
          status: body.status,
          note: body.note || null,
          recordedBy: member.uid,
          updatedAt: admin.firestore.Timestamp.fromDate(now),
        }

        if (body.status === 'paid') {
          feeData.paidAt = admin.firestore.Timestamp.fromDate(now)
        }

        await ref.set(feeData, { merge: true })

        return { ok: true, message: 'Fee recorded' }
      } catch (error: any) {
        console.error('[FINANCE] Error saving fee:', error)
        return reply.code(500).send({ error: 'Failed to save fee', details: error.message })
      }
    }
  )
}
