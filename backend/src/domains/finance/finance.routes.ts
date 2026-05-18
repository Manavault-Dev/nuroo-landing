import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'
import { config } from '../../config/index.js'
import { checkOrgHasFeature } from '../../modules/payments/planLimits.js'

// ─── Finance (attendance + fees) ─────────────────────────────────────────────

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
  } catch {}

  try {
    const userDoc = await db.doc(`users/${childId}`).get()
    if (userDoc.exists) {
      const d = userDoc.data()!
      const name = d.name || d.childName || d.displayName
      if (name && name !== 'Unknown') return name
    }
  } catch {}

  if (parentUserId && parentUserId !== childId) {
    try {
      const parentDoc = await db.doc(`users/${parentUserId}`).get()
      if (parentDoc.exists) {
        const d = parentDoc.data()!
        const name = d.childName || d.name
        if (name && name !== 'Unknown') return name
      }
    } catch {}
  }

  for (const uid of [childId, parentUserId].filter(Boolean) as string[]) {
    try {
      const authUser = await admin.auth().getUser(uid)
      if (authUser.displayName) return authUser.displayName
      if (authUser.email) return authUser.email.split('@')[0]
    } catch {}
  }

  return 'Unknown'
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
        const member = await requireOrgMember(request, reply, orgId)
        const uid = request.user!.uid

        const date = (request.query as any).date || new Date().toISOString().split('T')[0]

        const db = getFirestore()

        let childrenSnap: admin.firestore.QuerySnapshot
        if (member.role === 'org_admin') {
          childrenSnap = await db.collection(ORG_CHILDREN(orgId)).get()
        } else {
          childrenSnap = await db
            .collection(ORG_CHILDREN(orgId))
            .where('assigned', '==', true)
            .where('assignedSpecialistId', '==', uid)
            .get()
        }

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
        return reply.code(500).send({
          error: 'Failed to get attendance',
          details: config.NODE_ENV === 'production' ? undefined : error.message,
        })
      }
    }
  )

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof attendanceSchema> }>(
    '/orgs/:orgId/attendance',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        await requireOrgMember(request, reply, orgId)

        const featureCheck = await checkOrgHasFeature(orgId, 'finance')
        if (!featureCheck.ok) {
          return reply.code(403).send({ error: featureCheck.error, upgradeRequired: true })
        }

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
        return reply.code(500).send({
          error: 'Failed to save attendance',
          details: config.NODE_ENV === 'production' ? undefined : error.message,
        })
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
        return reply.code(500).send({
          error: 'Failed to get fees',
          details: config.NODE_ENV === 'production' ? undefined : error.message,
        })
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

        const featureCheck = await checkOrgHasFeature(orgId, 'finance')
        if (!featureCheck.ok) {
          return reply.code(403).send({ error: featureCheck.error, upgradeRequired: true })
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
        return reply.code(500).send({
          error: 'Failed to save fee',
          details: config.NODE_ENV === 'production' ? undefined : error.message,
        })
      }
    }
  )
}

// ─── Reports ──────────────────────────────────────────────────────────────────

const REPORT_COLLECTIONS = {
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  ORG_MEMBERS: (orgId: string) => `organizations/${orgId}/members`,
  CHILDREN: 'children',
  CHILD_TASKS: (childId: string) => `children/${childId}/tasks`,
  SPECIALIST_GROUPS: (uid: string) => `specialists/${uid}/groups`,
  GROUP_PARENTS: (uid: string, groupId: string) => `specialists/${uid}/groups/${groupId}/parents`,
  ALPHAKIDS_TASK_COMPLETIONS: 'alphakidsTaskCompletions',
} as const

function getTaskCounts(docs: admin.firestore.QueryDocumentSnapshot[]): {
  total: number
  completed: number
} {
  let completed = 0
  docs.forEach((doc) => {
    if (doc.data().status === 'completed') completed++
  })
  return { total: docs.length, completed }
}

async function getChildTaskCounts(
  db: admin.firestore.Firestore,
  childId: string
): Promise<{ total: number; completed: number }> {
  const ref = db.collection(REPORT_COLLECTIONS.CHILD_TASKS(childId))
  const snap = await ref.get()
  return getTaskCounts(snap.docs)
}

async function getChildTaskCountsInPeriod(
  db: admin.firestore.Firestore,
  childId: string,
  startDate: Date
): Promise<number> {
  const startTs = admin.firestore.Timestamp.fromDate(startDate)
  const ref = db.collection(REPORT_COLLECTIONS.CHILD_TASKS(childId))
  const snap = await ref.where('updatedAt', '>=', startTs).get()
  return snap.docs.filter((d) => d.data().status === 'completed').length
}

async function getChildName(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string
): Promise<string> {
  const uid = parentUserId || childId

  const childSnap = await db.doc(`${REPORT_COLLECTIONS.CHILDREN}/${childId}`).get()
  if (childSnap.exists) {
    const d = childSnap.data()
    const name = d?.name || d?.childName || d?.fullName
    if (name) return name as string
    if (d?.firstName) return d.lastName ? `${d.firstName} ${d.lastName}` : (d.firstName as string)
  }

  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.exists) {
    const d = userSnap.data()
    const name = d?.name || d?.childName || d?.fullName || d?.displayName
    if (name) return name as string
    if (d?.firstName) return d.lastName ? `${d.firstName} ${d.lastName}` : (d.firstName as string)
  }

  try {
    const user = await admin.auth().getUser(uid)
    if (user.displayName) return user.displayName
    if (user.email) return user.email.split('@')[0]
  } catch {}

  return childId
}

async function getParentDisplayName(uid: string): Promise<string> {
  try {
    const user = await admin.auth().getUser(uid)
    return user.displayName || user.email?.split('@')[0] || uid.slice(0, 8)
  } catch {
    return uid.slice(0, 8)
  }
}

async function getOrgContentCompletions(
  db: admin.firestore.Firestore,
  orgId: string,
  _startDate: Date,
  allowedChildIds?: Set<string>
): Promise<{
  totalCompleted: number
  completedLast7Days: number
  completedLast30Days: number
  byChild: Array<{ childId: string; count: number }>
}> {
  const now = new Date()
  const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const snap = await db
    .collection(REPORT_COLLECTIONS.ALPHAKIDS_TASK_COMPLETIONS)
    .where('orgId', '==', orgId)
    .where('completed', '==', true)
    .get()

  let totalCompleted = 0
  let completedLast7Days = 0
  let completedLast30Days = 0
  const childCounts = new Map<string, number>()

  snap.docs.forEach((doc) => {
    const data = doc.data()
    const childId = data.childId as string | undefined

    if (allowedChildIds && childId && !allowedChildIds.has(childId)) return

    totalCompleted++
    const completedAt = data.completedAt?.toDate?.() as Date | undefined
    if (completedAt) {
      if (completedAt >= start7) completedLast7Days++
      if (completedAt >= start30) completedLast30Days++
    }
    if (childId) {
      childCounts.set(childId, (childCounts.get(childId) || 0) + 1)
    }
  })

  const byChild = Array.from(childCounts.entries())
    .map(([childId, count]) => ({ childId, count }))
    .sort((a, b) => b.count - a.count)

  return { totalCompleted, completedLast7Days, completedLast30Days, byChild }
}

export const reportsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { orgId: string }
    Querystring: { days?: string }
  }>('/orgs/:orgId/reports', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const uid = request.user!.uid
      const daysParam = request.query.days
      const days = Math.min(Math.max(parseInt(daysParam || '30', 10) || 30, 7), 90)

      const db = getFirestore()
      const now = new Date()
      const start7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const start30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

      const orgChildrenRef = db.collection(REPORT_COLLECTIONS.ORG_CHILDREN(orgId))
      let docs: admin.firestore.QueryDocumentSnapshot[]

      if (member.role === 'org_admin') {
        const snap = await orgChildrenRef.where('assigned', '==', true).get()
        docs = snap.docs
      } else {
        const directSnap = await orgChildrenRef
          .where('assigned', '==', true)
          .where('assignedSpecialistId', '==', uid)
          .get()

        const seenIds = new Set(directSnap.docs.map((d) => d.id))
        docs = [...directSnap.docs]

        const groupsSnap = await db
          .collection(`specialists/${uid}/groups`)
          .where('orgId', '==', orgId)
          .get()

        const parentSnaps = await Promise.all(
          groupsSnap.docs.map((groupDoc) =>
            db.collection(`specialists/${uid}/groups/${groupDoc.id}/parents`).get()
          )
        )

        const newChildIds: string[] = []
        parentSnaps.forEach((parentsSnap) => {
          parentsSnap.docs.forEach((parentDoc) => {
            const childIds = (parentDoc.data().childIds as string[]) || []
            childIds.forEach((childId) => {
              if (!seenIds.has(childId)) {
                newChildIds.push(childId)
                seenIds.add(childId)
              }
            })
          })
        })

        const childBatches = await Promise.all(
          Array.from({ length: Math.ceil(newChildIds.length / 10) }, (_, index) => {
            const batch = newChildIds.slice(index * 10, index * 10 + 10)
            return orgChildrenRef.where(admin.firestore.FieldPath.documentId(), 'in', batch).get()
          })
        )
        childBatches.forEach((batchSnap) => docs.push(...batchSnap.docs))
      }

      const childIds: string[] = []
      const parentByChild = new Map<string, string>()
      const childNameFromLink = new Map<string, string>()
      docs.forEach((doc) => {
        const data = doc.data()
        const cid = doc.id
        const parentUid = data.parentUserId || data.parentUid
        childIds.push(cid)
        if (parentUid) parentByChild.set(cid, parentUid)
        const linkName =
          data.childName ||
          data.name ||
          data.fullName ||
          (data.firstName
            ? data.lastName
              ? `${data.firstName} ${data.lastName}`
              : data.firstName
            : undefined)
        if (linkName) childNameFromLink.set(cid, linkName as string)
      })

      const taskCountsCache = new Map<string, Promise<{ total: number; completed: number }>>()
      const periodCountsCache = new Map<string, Promise<number>>()
      const childNameCache = new Map<string, Promise<string>>()
      const userNameCache = new Map<string, Promise<string>>()

      const getCachedTaskCounts = (childId: string) => {
        if (!taskCountsCache.has(childId)) {
          taskCountsCache.set(childId, getChildTaskCounts(db, childId))
        }
        return taskCountsCache.get(childId)!
      }

      const getCachedPeriodCount = (childId: string, startDate: Date) => {
        const key = `${childId}:${startDate.toISOString()}`
        if (!periodCountsCache.has(key)) {
          periodCountsCache.set(key, getChildTaskCountsInPeriod(db, childId, startDate))
        }
        return periodCountsCache.get(key)!
      }

      const getCachedChildName = (childId: string, parentUid: string | null) => {
        if (!childNameCache.has(childId)) {
          childNameCache.set(childId, getChildName(db, childId, parentUid ?? undefined))
        }
        return childNameCache.get(childId)!
      }

      const getCachedUserName = (userId: string) => {
        if (!userNameCache.has(userId)) {
          userNameCache.set(userId, getParentDisplayName(userId))
        }
        return userNameCache.get(userId)!
      }

      const childCompletion = await Promise.all(
        childIds.map(async (childId) => {
          const parentUid = parentByChild.get(childId) ?? null
          const [{ total, completed }, childName, parentName] = await Promise.all([
            getCachedTaskCounts(childId),
            childNameFromLink.get(childId) ?? getCachedChildName(childId, parentUid),
            parentUid ? getCachedUserName(parentUid) : Promise.resolve(null),
          ])

          return {
            childId,
            childName,
            parentName,
            totalTasks: total,
            completedTasks: completed,
            percent: total > 0 ? Math.round((completed / total) * 100) : 0,
          }
        })
      )

      childCompletion.sort((a, b) => b.percent - a.percent)

      const groupCompletion: Array<{
        groupId: string
        groupName: string
        totalTasks: number
        completedTasks: number
        percent: number
        childCount: number
        specialistName?: string
        ownerId?: string
      }> = []

      const specialistIdsToFetch: string[] =
        member.role === 'org_admin'
          ? (await db.collection(REPORT_COLLECTIONS.ORG_MEMBERS(orgId)).get()).docs.map((d) => d.id)
          : [uid]

      const groupCompletionBySpecialist = await Promise.all(
        specialistIdsToFetch.map(async (specialistUid) => {
          const groupsSnapshot = await db
            .collection(REPORT_COLLECTIONS.SPECIALIST_GROUPS(specialistUid))
            .where('orgId', '==', orgId)
            .get()

          const specialistName =
            member.role === 'org_admin' ? await getCachedUserName(specialistUid) : undefined

          return Promise.all(
            groupsSnapshot.docs.map(async (groupDoc) => {
              const groupId = groupDoc.id
              const groupData = groupDoc.data()
              const groupName = (groupData.name as string) || 'Group'
              const parentsSnap = await db
                .collection(REPORT_COLLECTIONS.GROUP_PARENTS(specialistUid, groupId))
                .get()
              const allChildIdsInGroup = new Set<string>()
              parentsSnap.docs.forEach((pDoc) => {
                const childIdsArr = (pDoc.data().childIds as string[]) || []
                childIdsArr.forEach((id) => allChildIdsInGroup.add(id))
              })

              const counts = await Promise.all(
                Array.from(allChildIdsInGroup).map((cid) => getCachedTaskCounts(cid))
              )
              const groupTotal = counts.reduce((sum, count) => sum + count.total, 0)
              const groupCompleted = counts.reduce((sum, count) => sum + count.completed, 0)

              return {
                groupId,
                groupName,
                totalTasks: groupTotal,
                completedTasks: groupCompleted,
                percent: groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0,
                childCount: allChildIdsInGroup.size,
                ...(specialistName && { specialistName }),
                ...(member.role === 'org_admin' && { ownerId: specialistUid }),
              }
            })
          )
        })
      )

      groupCompletion.push(...groupCompletionBySpecialist.flat())

      groupCompletion.sort((a, b) => b.percent - a.percent)

      const parentUids = new Set<string>()
      parentByChild.forEach((u) => parentUids.add(u))

      const parentActivity = await Promise.all(
        Array.from(parentUids).map(async (parentUid) => {
          const theirChildIds = Array.from(parentByChild.entries())
            .filter(([, p]) => p === parentUid)
            .map(([cid]) => cid)
          const [periodCounts, parentName] = await Promise.all([
            Promise.all(
              theirChildIds.map(async (cid) => {
                const [completed7, completed30] = await Promise.all([
                  getCachedPeriodCount(cid, start7),
                  getCachedPeriodCount(cid, start30),
                ])
                return { completed7, completed30 }
              })
            ),
            getCachedUserName(parentUid),
          ])

          return {
            parentUserId: parentUid,
            parentName,
            completedLast7: periodCounts.reduce((sum, count) => sum + count.completed7, 0),
            completedLast30: periodCounts.reduce((sum, count) => sum + count.completed30, 0),
          }
        })
      )

      const topParents = [...parentActivity]
        .sort((a, b) => b.completedLast30 - a.completedLast30)
        .slice(0, 10)

      const lowActivity = parentActivity.filter((p) => p.completedLast7 === 0)

      const childIdSet = member.role === 'org_admin' ? undefined : new Set(childIds)
      const contentActivity = await getOrgContentCompletions(db, orgId, start30, childIdSet)

      return {
        ok: true,
        days,
        childCompletion,
        groupCompletion,
        parentActivity,
        topParents,
        lowActivity,
        contentActivity,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load reports'
      return reply.code(500).send({ error: message })
    }
  })
}
