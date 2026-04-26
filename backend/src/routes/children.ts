import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../plugins/rbac.js'
import type { ChildSummary, ChildDetail, ActivityDay, TimelineResponse } from '../types.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
})

const COLLECTIONS = {
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  CHILDREN: 'children',
  CHILD_PROGRESS: (childId: string) => `children/${childId}/progress/speech`,
  CHILD_TASKS: (childId: string) => `children/${childId}/tasks`,
  CHILD_FEEDBACK: (childId: string) => `children/${childId}/feedback`,
  ORG_PARENTS: (orgId: string) => `orgParents/${orgId}/parents`,
} as const

const DEFAULT_TIMELINE_DAYS = 30
const MIN_TIMELINE_DAYS = 7
const MAX_TIMELINE_DAYS = 90

interface ChildInfo {
  childId: string
  childName: string
  childAge?: number
  assignedAt: string | null
}

interface ParentConnection {
  parentUserId: string
  parentName: string
  parentEmail: string | null
  specialistId: string | null
  joinedAt: string | null
  children: ChildInfo[]
}

async function fetchAssignedChildren(
  db: admin.firestore.Firestore,
  orgId: string,
  role: string,
  uid: string
): Promise<{ docs: admin.firestore.QueryDocumentSnapshot[] }> {
  const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))

  if (role === 'org_admin') {
    return orgChildrenRef.where('assigned', '==', true).get()
  }

  const directSnap = await orgChildrenRef
    .where('assigned', '==', true)
    .where('assignedSpecialistId', '==', uid)
    .get()

  const seenIds = new Set(directSnap.docs.map((d) => d.id))
  const allDocs: admin.firestore.QueryDocumentSnapshot[] = [...directSnap.docs]

  const groupsSnap = await db
    .collection(`specialists/${uid}/groups`)
    .where('orgId', '==', orgId)
    .get()

  for (const groupDoc of groupsSnap.docs) {
    const parentsSnap = await db
      .collection(`specialists/${uid}/groups/${groupDoc.id}/parents`)
      .get()

    const newChildIds: string[] = []
    for (const parentDoc of parentsSnap.docs) {
      const childIds = (parentDoc.data().childIds as string[]) || []
      for (const childId of childIds) {
        if (!seenIds.has(childId)) {
          newChildIds.push(childId)
          seenIds.add(childId)
        }
      }
    }

    for (let i = 0; i < newChildIds.length; i += 10) {
      const batch = newChildIds.slice(i, i + 10)
      const batchSnap = await orgChildrenRef
        .where(admin.firestore.FieldPath.documentId(), 'in', batch)
        .get()
      allDocs.push(...batchSnap.docs)
    }
  }

  return { docs: allDocs }
}

function pickStoredProfileName(
  data: admin.firestore.DocumentData | null | undefined
): string | null {
  if (!data) return null
  const n =
    data.childName ||
    data.name ||
    data.displayName ||
    data.fullName ||
    data.registeredName ||
    data.nickname
  if (typeof n === 'string' && n.trim()) return n.trim()
  if (data.firstName) {
    const fn = data.firstName as string
    const ln = data.lastName as string | undefined
    return ln ? `${fn} ${ln}`.trim() : fn
  }
  return null
}

async function resolveChildName(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string,
  orgLinkData?: admin.firestore.DocumentData | null
): Promise<string> {
  const fromLink = pickStoredProfileName(orgLinkData ?? undefined)
  if (fromLink) return fromLink

  const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
  if (childSnap.exists) {
    const d = childSnap.data()
    const fromChild = pickStoredProfileName(d ?? undefined)
    if (fromChild && fromChild !== 'Unknown') return fromChild
  }

  const userSnap = await db.doc(`users/${childId}`).get()
  if (userSnap.exists) {
    const u = userSnap.data()
    const fromUser = pickStoredProfileName(u ?? undefined)
    if (fromUser && fromUser !== 'Unknown') return fromUser
  }

  if (parentUserId && parentUserId !== childId) {
    const parentSnap = await db.doc(`users/${parentUserId}`).get()
    if (parentSnap.exists) {
      const p = parentSnap.data()
      const fromParent = pickStoredProfileName(p ?? undefined)
      if (fromParent && fromParent !== 'Unknown') return fromParent
    }
  }

  const authUids = [...new Set([childId, parentUserId].filter(Boolean) as string[])]
  for (const uid of authUids) {
    try {
      const user = await admin.auth().getUser(uid)
      if (user.displayName?.trim()) return user.displayName.trim()
      if (user.email) return user.email.split('@')[0]
    } catch {}
  }

  return 'Unknown'
}

function resolveChildNameFromData(
  childId: string,
  childData: admin.firestore.DocumentData | null | undefined,
  userData: admin.firestore.DocumentData | null | undefined
): string | null {
  const childName =
    childData?.name ||
    childData?.childName ||
    childData?.fullName ||
    (childData?.firstName
      ? childData.lastName
        ? `${childData.firstName} ${childData.lastName}`
        : childData.firstName
      : undefined)
  if (childName) return childName as string

  const userName =
    userData?.name ||
    userData?.childName ||
    userData?.fullName ||
    userData?.displayName ||
    (userData?.firstName
      ? userData.lastName
        ? `${userData.firstName} ${userData.lastName}`
        : userData.firstName
      : undefined)
  if (userName) return userName as string

  return childId || null
}

async function fetchChildDetails(
  db: admin.firestore.Firestore,
  childId: string,
  parentUserId?: string,
  orgLinkData?: admin.firestore.DocumentData | null
) {
  const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
  const childData = childSnap.exists ? childSnap.data() : null

  const userSnap = await db.doc(`users/${childId}`).get()
  const userData = userSnap.exists ? userSnap.data() : null

  const name = await resolveChildName(db, childId, parentUserId, orgLinkData)
  const age = childData?.age || childData?.childAge || userData?.age || userData?.childAge

  return { name, age }
}

function groupChildrenByParent(childrenDocs: admin.firestore.QueryDocumentSnapshot[]): {
  parentMap: Map<string, ChildInfo[]>
  orgLinkByChildId: Map<string, admin.firestore.DocumentData>
} {
  const parentMap = new Map<string, ChildInfo[]>()
  const orgLinkByChildId = new Map<string, admin.firestore.DocumentData>()

  for (const childDoc of childrenDocs) {
    const linkData = childDoc.data()
    const childId = childDoc.id
    const parentUserId = linkData.parentUserId

    orgLinkByChildId.set(childId, linkData)

    if (!parentUserId) {
      continue
    }

    if (!parentMap.has(parentUserId)) {
      parentMap.set(parentUserId, [])
    }

    parentMap.get(parentUserId)!.push({
      childId,
      childName: 'Unknown',
      childAge: undefined,
      assignedAt: linkData.assignedAt?.toDate?.()?.toISOString() || null,
    })
  }

  return { parentMap, orgLinkByChildId }
}

async function enrichChildrenWithDetails(
  db: admin.firestore.Firestore,
  parentMap: Map<string, ChildInfo[]>,
  orgLinkByChildId: Map<string, admin.firestore.DocumentData>
) {
  await Promise.all(
    Array.from(parentMap.entries()).flatMap(([parentUserId, children]) =>
      children.map(async (child) => {
        const linkData = orgLinkByChildId.get(child.childId)
        const details = await fetchChildDetails(db, child.childId, parentUserId, linkData)
        child.childName = details.name
        child.childAge = details.age
      })
    )
  )
}

async function resolveUserName(
  db: admin.firestore.Firestore,
  uid: string
): Promise<{ name: string; email: string | null }> {
  const userSnap = await db.doc(`users/${uid}`).get()
  if (userSnap.exists) {
    const d = userSnap.data()!
    const name = d.name || d.childName || d.fullName || d.displayName
    if (name) return { name: name as string, email: d.email || null }
  }

  try {
    const user = await admin.auth().getUser(uid)
    const name = user.displayName || user.email?.split('@')[0] || uid.slice(0, 8)
    return { name, email: user.email || null }
  } catch {
    return { name: uid.slice(0, 8), email: null }
  }
}

async function buildParentConnection(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUserId: string,
  children: ChildInfo[]
): Promise<ParentConnection> {
  const { name: parentName, email: parentEmail } = await resolveUserName(db, parentUserId)

  const orgParentRef = db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`)
  const orgParentSnap = await orgParentRef.get()
  const orgParentData = orgParentSnap.exists ? orgParentSnap.data() : null

  return {
    parentUserId,
    parentName,
    parentEmail,
    specialistId: orgParentData?.linkedSpecialistUid || null,
    joinedAt: orgParentData?.joinedAt?.toDate?.()?.toISOString() || null,
    children,
  }
}

async function fetchChildProgress(db: admin.firestore.Firestore, childId: string) {
  const progressRef = db.doc(COLLECTIONS.CHILD_PROGRESS(childId))
  const progressSnap = await progressRef.get()
  return progressSnap.exists ? progressSnap.data() : null
}

async function countCompletedTasks(db: admin.firestore.Firestore, childId: string) {
  const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
  const tasksSnapshot = await tasksRef.where('status', '==', 'completed').get()
  return tasksSnapshot.size
}

function _transformChildSummary(
  childId: string,
  childData: admin.firestore.DocumentData | null | undefined,
  progressData: admin.firestore.DocumentData | null | undefined,
  completedTasksCount: number
): ChildSummary {
  return {
    id: childId,
    name: childData?.name || childData?.childName || 'Unknown',
    age: childData?.age || childData?.childAge,
    speechStepId: progressData?.currentStepId,
    speechStepNumber: progressData?.currentStepNumber,
    lastActiveDate: childData?.lastActiveDate?.toDate() || childData?.updatedAt?.toDate(),
    completedTasksCount,
  }
}

function parseTimelineDays(daysParam: string | undefined): number {
  const days = parseInt(daysParam || String(DEFAULT_TIMELINE_DAYS), 10)
  return Math.min(Math.max(days, MIN_TIMELINE_DAYS), MAX_TIMELINE_DAYS)
}

function buildActivityMap(
  tasksDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, { attempted: number; completed: number }> {
  const activityMap = new Map<string, { attempted: number; completed: number }>()

  tasksDocs.forEach((doc) => {
    const taskData = doc.data()
    const updatedAt = taskData.updatedAt?.toDate() || new Date()
    const dateKey = updatedAt.toISOString().split('T')[0]

    if (!activityMap.has(dateKey)) {
      activityMap.set(dateKey, { attempted: 0, completed: 0 })
    }

    const day = activityMap.get(dateKey)!
    day.attempted++

    if (taskData.status === 'completed') {
      day.completed++
    }
  })

  return activityMap
}

function buildFeedbackMap(
  feedbackDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }> {
  const feedbackMap = new Map()

  feedbackDocs.forEach((doc) => {
    const feedbackData = doc.data()
    const timestamp = feedbackData.timestamp?.toDate() || new Date()
    const dateKey = timestamp.toISOString().split('T')[0]

    feedbackMap.set(dateKey, {
      mood: feedbackData.mood || 'ok',
      comment: feedbackData.comment,
      timestamp,
    })
  })

  return feedbackMap
}

function buildTimelineDays(
  days: number,
  activityMap: Map<string, { attempted: number; completed: number }>,
  feedbackMap: Map<string, { mood: 'good' | 'ok' | 'hard'; comment?: string; timestamp: Date }>
): ActivityDay[] {
  const timelineDays: ActivityDay[] = []
  const now = new Date()

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateKey = date.toISOString().split('T')[0]
    const activity = activityMap.get(dateKey) || { attempted: 0, completed: 0 }
    const feedback = feedbackMap.get(dateKey)

    timelineDays.push({
      date: dateKey,
      tasksAttempted: activity.attempted,
      tasksCompleted: activity.completed,
      feedback: feedback
        ? {
            mood: feedback.mood,
            comment: feedback.comment,
            timestamp: feedback.timestamp,
          }
        : undefined,
    })
  }

  return timelineDays
}

export const childrenRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/connections', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const role = member.role

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const { parentMap, orgLinkByChildId } = groupChildrenByParent(assignedChildrenSnap.docs)

      await enrichChildrenWithDetails(db, parentMap, orgLinkByChildId)

      const connections = await Promise.all(
        Array.from(parentMap.entries()).map(([parentUserId, children]) =>
          buildParentConnection(db, orgId, parentUserId, children)
        )
      )

      return {
        ok: true,
        connections,
        count: connections.length,
      }
    } catch (error: unknown) {
      console.error('[CONNECTIONS] Error fetching connections:', error)
      return reply.code(500).send({
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/children', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const role = member.role

      console.log(`[CHILDREN] Fetching children for org=${orgId}, user=${uid}, role=${role}`)

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const childIds = assignedChildrenSnap.docs.map((doc) => doc.id)

      console.log(`[CHILDREN] Found ${childIds.length} assigned children for user ${uid}`)

      if (childIds.length === 0) {
        return []
      }

      const children = await Promise.all(
        childIds.map(async (childId): Promise<ChildSummary> => {
          const linkDoc = assignedChildrenSnap.docs.find((d) => d.id === childId)
          const linkData = linkDoc?.data()
          const parentUserId = linkData?.parentUserId

          const [progressData, completedTasksCount, userSnap, childSnap] = await Promise.all([
            fetchChildProgress(db, childId),
            countCompletedTasks(db, childId),
            db.doc(`users/${childId}`).get(),
            db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get(),
          ])

          const userData = userSnap.exists ? userSnap.data() : null
          const childData = childSnap.exists ? childSnap.data() : null
          let childName =
            pickStoredProfileName(linkData) ||
            resolveChildNameFromData(childId, childData, userData)

          if (!childName || childName === childId) {
            childName = await resolveChildName(db, childId, parentUserId, linkData)
          }

          return {
            id: childId,
            name: childName,
            age: childData?.age || childData?.childAge || userData?.age || userData?.childAge,
            speechStepId: progressData?.currentStepId,
            speechStepNumber: progressData?.currentStepNumber,
            lastActiveDate:
              childData?.lastActiveDate?.toDate() ||
              childData?.updatedAt?.toDate() ||
              userData?.updatedAt?.toDate?.(),
            completedTasksCount,
          }
        })
      )

      return children
    } catch (error: unknown) {
      console.error('[CHILDREN] Error fetching children:', error)
      return reply.code(500).send({
        error: 'Failed to fetch children',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params

        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()

        const linkSnap = await db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${resolvedChildId}`).get()
        const linkData = linkSnap.exists ? linkSnap.data() : null
        const parentUserId = linkData?.parentUserId

        const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${resolvedChildId}`)
        const childSnap = await childRef.get()
        const childData = childSnap.exists ? childSnap.data() : null

        const userSnap = await db.doc(`users/${resolvedChildId}`).get()
        const userData = userSnap.exists ? userSnap.data() : null

        if (!childSnap.exists && !userSnap.exists) {
          return reply.code(404).send({ error: 'Child not found' })
        }

        const childName = await resolveChildName(db, resolvedChildId, parentUserId, linkData)
        const progressData = await fetchChildProgress(db, resolvedChildId)

        const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(resolvedChildId))
        const tasksSnapshot = await tasksRef.orderBy('updatedAt', 'desc').limit(10).get()

        const recentTasks = tasksSnapshot.docs.map((doc) => {
          const taskData = doc.data()
          return {
            id: doc.id,
            title: taskData.title || 'Untitled Task',
            status: taskData.status || 'pending',
            completedAt: taskData.completedAt?.toDate(),
          }
        })

        const completedTasksCount = await countCompletedTasks(db, resolvedChildId)

        const detail: ChildDetail = {
          id: resolvedChildId,
          name: childName,
          age: childData?.age || userData?.age,
          organizationId: childData?.organizationId || orgId,
          speechStepId: progressData?.currentStepId,
          speechStepNumber: progressData?.currentStepNumber,
          lastActiveDate: childData?.lastActiveDate?.toDate() || userData?.updatedAt?.toDate?.(),
          completedTasksCount,
          recentTasks,
        }

        return detail
      } catch (error: unknown) {
        console.error('[CHILDREN] Error fetching child detail:', error)
        return reply.code(500).send({
          error: 'Failed to fetch child details',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.get<{
    Params: { orgId: string; childId: string }
    Querystring: { days?: string }
  }>('/orgs/:orgId/children/:childId/timeline', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      const days = parseTimelineDays(request.query.days)

      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const now = new Date()
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)

      const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(resolvedChildId))
      const tasksSnapshot = await tasksRef
        .where('updatedAt', '>=', startTimestamp)
        .orderBy('updatedAt', 'desc')
        .get()

      const feedbackRef = db.collection(COLLECTIONS.CHILD_FEEDBACK(resolvedChildId))
      const feedbackSnapshot = await feedbackRef.where('timestamp', '>=', startTimestamp).get()

      const activityMap = buildActivityMap(tasksSnapshot.docs)
      const feedbackMap = buildFeedbackMap(feedbackSnapshot.docs)
      const timelineDays = buildTimelineDays(days, activityMap, feedbackMap)

      const response: TimelineResponse = { days: timelineDays }
      return response
    } catch (error: unknown) {
      console.error('[CHILDREN] Error fetching timeline:', error)
      return reply.code(500).send({
        error: 'Failed to fetch timeline',
        details: error instanceof Error ? error.message : '',
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(resolvedChildId))
        const snapshot = await tasksRef.orderBy('updatedAt', 'desc').get()

        const tasks = snapshot.docs.map((doc) => {
          const d = doc.data()
          return {
            id: doc.id,
            title: d.title || 'Untitled Task',
            description: d.description ?? null,
            status: d.status || 'pending',
            createdBy: d.createdBy ?? null,
            createdAt: d.createdAt?.toDate() ?? null,
            updatedAt: d.updatedAt?.toDate() ?? null,
            completedAt: d.completedAt?.toDate() ?? null,
            submissionText: d.submissionText ?? null,
            fileUrl: d.fileUrl ?? null,
            submittedAt: d.submittedAt?.toDate() ?? null,
          }
        })
        return { tasks }
      } catch (error: unknown) {
        console.error('[CHILDREN] Error listing tasks:', error)
        return reply.code(500).send({
          error: 'Failed to list tasks',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.delete<{ Params: { orgId: string; parentUserId: string } }>(
    '/orgs/:orgId/connections/:parentUserId',
    async (request, reply) => {
      try {
        const { orgId, parentUserId } = request.params
        const member = await requireOrgMember(request, reply, orgId)
        if (member.role !== 'org_admin') {
          return reply.code(403).send({ error: 'Only org admins can disconnect parents' })
        }

        const db = getFirestore()
        const now = admin.firestore.Timestamp.fromDate(new Date())

        const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))
        const childrenSnap = await orgChildrenRef.where('parentUserId', '==', parentUserId).get()

        let childrenUnlinked = 0
        if (!childrenSnap.empty) {
          const BATCH_SIZE = 400
          for (let i = 0; i < childrenSnap.docs.length; i += BATCH_SIZE) {
            const batch = db.batch()
            for (const doc of childrenSnap.docs.slice(i, i + BATCH_SIZE)) {
              batch.update(doc.ref, { assigned: false, disconnectedAt: now })
              childrenUnlinked++
            }
            await batch.commit()
          }
        }

        await db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/${parentUserId}`).delete()

        const membersSnap = await db.collection(`organizations/${orgId}/members`).get()
        let groupsUpdated = 0

        for (const memberDoc of membersSnap.docs) {
          const memberId = memberDoc.id
          let groupsSnap: admin.firestore.QuerySnapshot
          try {
            groupsSnap = await db
              .collection(`specialists/${memberId}/groups`)
              .where('orgId', '==', orgId)
              .get()
          } catch {
            continue
          }
          for (const groupDoc of groupsSnap.docs) {
            const parentRef = db.doc(
              `specialists/${memberId}/groups/${groupDoc.id}/parents/${parentUserId}`
            )
            const parentSnap = await parentRef.get()
            if (parentSnap.exists) {
              await parentRef.delete()
              groupsUpdated++
            }
          }
        }

        return { ok: true, childrenUnlinked, groupsUpdated }
      } catch (error: unknown) {
        console.error('[CONNECTIONS] Error disconnecting parent:', error)
        return reply.code(500).send({
          error: 'Failed to disconnect parent',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )

  fastify.post<{
    Params: { orgId: string; childId: string }
    Body: z.infer<typeof createTaskSchema>
  }>('/orgs/:orgId/children/:childId/tasks', async (request, reply) => {
    try {
      const { orgId, childId } = request.params
      await requireOrgMember(request, reply, orgId)
      const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)
      if (!request.user) return

      const parse = createTaskSchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Invalid body: title required (1–500 chars), description optional',
        })
      }
      const { title, description } = parse.data

      const db = getFirestore()
      const now = admin.firestore.Timestamp.fromDate(new Date())
      const taskData = {
        title,
        description: description ?? null,
        status: 'pending',
        createdBy: request.user.uid,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      }
      const taskRef = await db.collection(COLLECTIONS.CHILD_TASKS(resolvedChildId)).add(taskData)

      return reply.code(201).send({
        id: taskRef.id,
        ...taskData,
        createdAt: taskData.createdAt.toDate(),
        updatedAt: taskData.updatedAt.toDate(),
      })
    } catch (error: unknown) {
      console.error('[CHILDREN] Error creating task:', error)
      return reply.code(500).send({
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
}
