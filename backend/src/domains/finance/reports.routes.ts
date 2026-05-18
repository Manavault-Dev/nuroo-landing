import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../plugins/rbac.js'

const COLLECTIONS = {
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
  const ref = db.collection(COLLECTIONS.CHILD_TASKS(childId))
  const snap = await ref.get()
  return getTaskCounts(snap.docs)
}

async function getChildTaskCountsInPeriod(
  db: admin.firestore.Firestore,
  childId: string,
  startDate: Date
): Promise<number> {
  const startTs = admin.firestore.Timestamp.fromDate(startDate)
  const ref = db.collection(COLLECTIONS.CHILD_TASKS(childId))
  const snap = await ref.where('updatedAt', '>=', startTs).get()
  return snap.docs.filter((d) => d.data().status === 'completed').length
}

async function getChildName(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string
): Promise<string> {
  const uid = parentUserId || childId

  const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
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
    .collection(COLLECTIONS.ALPHAKIDS_TASK_COMPLETIONS)
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

      const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))
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
          ? (await db.collection(COLLECTIONS.ORG_MEMBERS(orgId)).get()).docs.map((d) => d.id)
          : [uid]

      const groupCompletionBySpecialist = await Promise.all(
        specialistIdsToFetch.map(async (specialistUid) => {
          const groupsSnapshot = await db
            .collection(COLLECTIONS.SPECIALIST_GROUPS(specialistUid))
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
                .collection(COLLECTIONS.GROUP_PARENTS(specialistUid, groupId))
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
