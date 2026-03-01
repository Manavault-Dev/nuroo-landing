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
) {
  const orgChildrenRef = db.collection(COLLECTIONS.ORG_CHILDREN(orgId))

  if (role === 'org_admin') {
    return await orgChildrenRef.where('assigned', '==', true).get()
  }

  return await orgChildrenRef
    .where('assigned', '==', true)
    .where('assignedSpecialistId', '==', uid)
    .get()
}

async function fetchChildDetails(db: admin.firestore.Firestore, childId: string) {
  const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
  const childSnap = await childRef.get()

  if (!childSnap.exists) {
    return {
      name: 'Unknown',
      age: undefined,
    }
  }

  const childData = childSnap.data()!
  return {
    name: childData.name || childData.childName || 'Unknown',
    age: childData.age || childData.childAge,
  }
}

function groupChildrenByParent(
  childrenDocs: admin.firestore.QueryDocumentSnapshot[]
): Map<string, ChildInfo[]> {
  const parentMap = new Map<string, ChildInfo[]>()

  for (const childDoc of childrenDocs) {
    const linkData = childDoc.data()
    const childId = childDoc.id
    const parentUserId = linkData.parentUserId

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

  return parentMap
}

async function enrichChildrenWithDetails(
  db: admin.firestore.Firestore,
  parentMap: Map<string, ChildInfo[]>
) {
  for (const [parentUserId, children] of parentMap.entries()) {
    for (const child of children) {
      const details = await fetchChildDetails(db, child.childId)
      child.childName = details.name
      child.childAge = details.age
    }
  }
}

async function fetchParentAuthData(parentUserId: string) {
  try {
    const auth = admin.auth()
    const parentUser = await auth.getUser(parentUserId)
    return {
      email: parentUser.email || null,
      displayName: parentUser.displayName || null,
    }
  } catch {
    return {
      email: null,
      displayName: null,
    }
  }
}

async function buildParentConnection(
  db: admin.firestore.Firestore,
  orgId: string,
  parentUserId: string,
  children: ChildInfo[]
): Promise<ParentConnection> {
  const authData = await fetchParentAuthData(parentUserId)

  const orgParentRef = db.doc(`${COLLECTIONS.ORG_PARENTS(orgId)}/parents/${parentUserId}`)
  const orgParentSnap = await orgParentRef.get()
  const orgParentData = orgParentSnap.exists ? orgParentSnap.data() : null

  return {
    parentUserId,
    parentName: authData.displayName || 'Unknown',
    parentEmail: authData.email,
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

function transformChildSummary(
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
      const parentMap = groupChildrenByParent(assignedChildrenSnap.docs)

      await enrichChildrenWithDetails(db, parentMap)

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
    } catch (error: any) {
      console.error('[CONNECTIONS] Error fetching connections:', error)
      return reply.code(500).send({
        error: 'Failed to fetch connections',
        details: error.message,
      })
    }
  })

  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/children', async (request, reply) => {
    try {
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      const { uid } = request.user!
      const role = member.role

      const db = getFirestore()
      const assignedChildrenSnap = await fetchAssignedChildren(db, orgId, role, uid)
      const childIds = assignedChildrenSnap.docs.map((doc) => doc.id)

      if (childIds.length === 0) {
        return []
      }

      const children: ChildSummary[] = []

      for (const childId of childIds) {
        const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
        const childSnap = await childRef.get()
        const childData = childSnap.exists ? childSnap.data() : null
        const progressData = childSnap.exists ? await fetchChildProgress(db, childId) : null
        const completedTasksCount = childSnap.exists ? await countCompletedTasks(db, childId) : 0

        children.push(transformChildSummary(childId, childData, progressData, completedTasksCount))
      }

      return children
    } catch (error: any) {
      console.error('[CHILDREN] Error fetching children:', error)
      return reply.code(500).send({
        error: 'Failed to fetch children',
        details: error.message,
      })
    }
  })

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params

        await requireOrgMember(request, reply, orgId)
        await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
        const childSnap = await childRef.get()

        if (!childSnap.exists) {
          return reply.code(404).send({ error: 'Child not found' })
        }

        const childData = childSnap.data()!
        const progressData = await fetchChildProgress(db, childId)

        const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
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

        const completedTasksCount = await countCompletedTasks(db, childId)

        const detail: ChildDetail = {
          id: childSnap.id,
          name: childData.name || 'Unknown',
          age: childData.age,
          organizationId: childData.organizationId || orgId,
          speechStepId: progressData?.currentStepId,
          speechStepNumber: progressData?.currentStepNumber,
          lastActiveDate: childData.lastActiveDate?.toDate(),
          completedTasksCount,
          recentTasks,
        }

        return detail
      } catch (error: any) {
        console.error('[CHILDREN] Error fetching child detail:', error)
        return reply.code(500).send({
          error: 'Failed to fetch child details',
          details: error.message,
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
      await requireChildAccess(request, reply, orgId, childId)

      const db = getFirestore()
      const now = new Date()
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      const startTimestamp = admin.firestore.Timestamp.fromDate(startDate)

      const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
      const tasksSnapshot = await tasksRef
        .where('updatedAt', '>=', startTimestamp)
        .orderBy('updatedAt', 'desc')
        .get()

      const feedbackRef = db.collection(COLLECTIONS.CHILD_FEEDBACK(childId))
      const feedbackSnapshot = await feedbackRef.where('timestamp', '>=', startTimestamp).get()

      const activityMap = buildActivityMap(tasksSnapshot.docs)
      const feedbackMap = buildFeedbackMap(feedbackSnapshot.docs)
      const timelineDays = buildTimelineDays(days, activityMap, feedbackMap)

      const response: TimelineResponse = { days: timelineDays }
      return response
    } catch (error: any) {
      console.error('[CHILDREN] Error fetching timeline:', error)
      return reply.code(500).send({
        error: 'Failed to fetch timeline',
        details: error.message,
      })
    }
  })

  // ——— Tasks: list and create (specialist/org_admin) ———
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const tasksRef = db.collection(COLLECTIONS.CHILD_TASKS(childId))
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
          }
        })
        return { tasks }
      } catch (error: any) {
        console.error('[CHILDREN] Error listing tasks:', error)
        return reply.code(500).send({
          error: 'Failed to list tasks',
          details: error.message,
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
      const member = await requireOrgMember(request, reply, orgId)
      await requireChildAccess(request, reply, orgId, childId)
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
      const taskRef = await db.collection(COLLECTIONS.CHILD_TASKS(childId)).add(taskData)

      return reply.code(201).send({
        id: taskRef.id,
        ...taskData,
        createdAt: taskData.createdAt.toDate(),
        updatedAt: taskData.updatedAt.toDate(),
      })
    } catch (error: any) {
      console.error('[CHILDREN] Error creating task:', error)
      return reply.code(500).send({
        error: 'Failed to create task',
        details: error.message,
      })
    }
  })
}
