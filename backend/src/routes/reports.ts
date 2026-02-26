import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember } from '../plugins/rbac.js'

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

async function getChildName(db: admin.firestore.Firestore, childId: string): Promise<string> {
  const snap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
  if (!snap.exists) return 'Unknown'
  const d = snap.data()
  return (d?.name || d?.childName || 'Unknown') as string
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
  startDate: Date
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
    totalCompleted++
    const completedAt = data.completedAt?.toDate?.() as Date | undefined
    if (completedAt) {
      if (completedAt >= start7) completedLast7Days++
      if (completedAt >= start30) completedLast30Days++
    }
    const childId = data.childId as string | undefined
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
      const orgChildrenSnap = await orgChildrenRef.where('assigned', '==', true).get()
      const docs =
        member.role === 'org_admin'
          ? orgChildrenSnap.docs
          : orgChildrenSnap.docs.filter((d) => (d.data().assignedSpecialistId as string) === uid)

      const childIds: string[] = []
      const parentByChild = new Map<string, string>()
      docs.forEach((doc) => {
        const data = doc.data()
        const cid = doc.id
        const parentUid = data.parentUserId || data.parentUid
        childIds.push(cid)
        if (parentUid) parentByChild.set(cid, parentUid)
      })

      const childCompletion: Array<{
        childId: string
        childName: string
        parentName: string | null
        totalTasks: number
        completedTasks: number
        percent: number
      }> = []

      for (const childId of childIds) {
        const { total, completed } = await getChildTaskCounts(db, childId)
        const childName = await getChildName(db, childId)
        const parentUid = parentByChild.get(childId) ?? null
        const parentName = parentUid ? await getParentDisplayName(parentUid) : null
        childCompletion.push({
          childId,
          childName,
          parentName,
          totalTasks: total,
          completedTasks: completed,
          percent: total > 0 ? Math.round((completed / total) * 100) : 0,
        })
      }

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

      for (const specialistUid of specialistIdsToFetch) {
        const groupsSnapshot = await db
          .collection(COLLECTIONS.SPECIALIST_GROUPS(specialistUid))
          .where('orgId', '==', orgId)
          .get()

        let specialistName: string | undefined
        if (member.role === 'org_admin') {
          try {
            const u = await admin.auth().getUser(specialistUid)
            specialistName = u.displayName || u.email?.split('@')[0] || specialistUid.slice(0, 8)
          } catch {
            specialistName = specialistUid.slice(0, 8)
          }
        }

        for (const groupDoc of groupsSnapshot.docs) {
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
          let groupTotal = 0
          let groupCompleted = 0
          for (const cid of allChildIdsInGroup) {
            const { total, completed } = await getChildTaskCounts(db, cid)
            groupTotal += total
            groupCompleted += completed
          }
          groupCompletion.push({
            groupId,
            groupName,
            totalTasks: groupTotal,
            completedTasks: groupCompleted,
            percent: groupTotal > 0 ? Math.round((groupCompleted / groupTotal) * 100) : 0,
            childCount: allChildIdsInGroup.size,
            ...(specialistName && { specialistName }),
            ...(member.role === 'org_admin' && { ownerId: specialistUid }),
          })
        }
      }

      groupCompletion.sort((a, b) => b.percent - a.percent)

      const parentUids = new Set<string>()
      parentByChild.forEach((u) => parentUids.add(u))

      const parentActivity: Array<{
        parentUserId: string
        parentName: string
        completedLast7: number
        completedLast30: number
      }> = []

      for (const parentUid of parentUids) {
        const theirChildIds = Array.from(parentByChild.entries())
          .filter(([, p]) => p === parentUid)
          .map(([cid]) => cid)
        let completed7 = 0
        let completed30 = 0
        for (const cid of theirChildIds) {
          completed7 += await getChildTaskCountsInPeriod(db, cid, start7)
          completed30 += await getChildTaskCountsInPeriod(db, cid, start30)
        }
        const parentName = await getParentDisplayName(parentUid)
        parentActivity.push({
          parentUserId: parentUid,
          parentName,
          completedLast7: completed7,
          completedLast30: completed30,
        })
      }

      const topParents = [...parentActivity]
        .sort((a, b) => b.completedLast30 - a.completedLast30)
        .slice(0, 10)

      const lowActivity = parentActivity.filter((p) => p.completedLast7 === 0)

      // P1 fix: Include content completions from alphakidsTaskCompletions
      const contentActivity = await getOrgContentCompletions(db, orgId, start30)

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
