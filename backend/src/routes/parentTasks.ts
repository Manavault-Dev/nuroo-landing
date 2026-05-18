import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'
import { dispatch } from '../modules/notifications/index.js'

const COLLECTIONS = {
  CHILDREN: 'children',
  CHILD_TASKS: (childId: string) => `children/${childId}/tasks`,
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
  ORG_MONTHLY_FEES: (orgId: string) => `organizations/${orgId}/monthlyFees`,
} as const

function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const completeBodySchema = z.object({
  completed: z.boolean(),
})

export const parentTasksRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { childId: string } }>(
    '/api/parent/children/:childId/tasks',
    async (request, reply) => {
      try {
        if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
        const uid = request.user.uid
        const { childId } = request.params

        const db = getFirestore()
        const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
        const childSnap = await childRef.get()
        if (!childSnap.exists) {
          return reply.code(404).send({ error: 'Child not found' })
        }
        const orgId = childSnap.data()?.organizationId
        if (!orgId) {
          return reply.code(403).send({ error: 'Child is not linked to an organization' })
        }

        const orgChildRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`)
        const orgChildSnap = await orgChildRef.get()
        if (!orgChildSnap.exists || orgChildSnap.data()?.parentUserId !== uid) {
          return reply.code(403).send({ error: 'Only the parent can list this child’s tasks' })
        }

        const snapshot = await db
          .collection(COLLECTIONS.CHILD_TASKS(childId))
          .orderBy('updatedAt', 'desc')
          .get()

        const tasks = snapshot.docs.map((doc) => {
          const d = doc.data()
          return {
            id: doc.id,
            title: d.title || 'Untitled Task',
            description: d.description ?? null,
            status: d.status || 'pending',
            createdAt: d.createdAt?.toDate() ?? null,
            updatedAt: d.updatedAt?.toDate() ?? null,
            completedAt: d.completedAt?.toDate() ?? null,
          }
        })
        return { tasks }
      } catch (error: any) {
        console.error('[PARENT_TASKS] Error listing tasks:', error)
        return reply.code(500).send({
          error: 'Failed to list tasks',
          details: error.message,
        })
      }
    }
  )

  fastify.post<{
    Params: { childId: string; taskId: string }
    Body: z.infer<typeof completeBodySchema>
  }>('/api/parent/children/:childId/tasks/:taskId/complete', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }
      const uid = request.user.uid
      const { childId, taskId } = request.params

      const parse = completeBodySchema.safeParse(request.body)
      if (!parse.success) {
        return reply.code(400).send({
          error: 'Bad Request',
          message: 'Body must include { completed: boolean }',
        })
      }
      const { completed } = parse.data

      const db = getFirestore()

      const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
      const childSnap = await childRef.get()
      if (!childSnap.exists) {
        return reply.code(404).send({ error: 'Child not found' })
      }
      const orgId = childSnap.data()?.organizationId
      if (!orgId) {
        return reply.code(403).send({ error: 'Child is not linked to an organization' })
      }

      const orgChildRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`)
      const orgChildSnap = await orgChildRef.get()
      if (!orgChildSnap.exists) {
        return reply.code(404).send({ error: 'Child not found in organization' })
      }
      const parentUserId = orgChildSnap.data()?.parentUserId
      if (parentUserId !== uid) {
        return reply.code(403).send({ error: 'Only the parent of this child can complete tasks' })
      }

      const taskRef = db.doc(`${COLLECTIONS.CHILD_TASKS(childId)}/${taskId}`)
      const taskSnap = await taskRef.get()
      if (!taskSnap.exists) {
        return reply.code(404).send({ error: 'Task not found' })
      }

      const now = admin.firestore.Timestamp.fromDate(new Date())
      const taskTitle = taskSnap.data()?.title || 'Task'
      const childName = childSnap.data()?.name || 'Child'

      await taskRef.update({
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? now : null,
        updatedAt: now,
      })

      if (completed) {
        const specialistId = orgChildSnap.data()?.assignedSpecialistId
        if (specialistId) {
          dispatch({
            userId: specialistId,
            orgId,
            role: 'specialist',
            type: 'task_completed',
            category: 'assignments',
            title: '✅ Task completed',
            body: `${childName}'s parent marked "${taskTitle}" as done`,
            metadata: { childId, taskId, orgId },
            dedupKey: `task_completed:${taskId}`,
            channel: 'both',
          }).catch(() => {})
        }
      }

      return {
        ok: true,
        taskId,
        status: completed ? 'completed' : 'pending',
        updatedAt: now.toDate(),
      }
    } catch (error: any) {
      console.error('[PARENT_TASKS] Error completing task:', error)
      return reply.code(500).send({
        error: 'Failed to update task',
        details: error.message,
      })
    }
  })

  fastify.patch<{
    Params: { childId: string; taskId: string }
    Body: { submissionText?: string; fileUrl?: string }
  }>('/api/parent/children/:childId/tasks/:taskId/submit', async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const uid = request.user.uid
      const { childId, taskId } = request.params
      const db = getFirestore()

      const childRef = db.doc(`${COLLECTIONS.CHILDREN}/${childId}`)
      const childSnap = await childRef.get()
      if (!childSnap.exists) return reply.code(404).send({ error: 'Child not found' })

      const orgId = childSnap.data()?.organizationId
      if (!orgId) return reply.code(403).send({ error: 'Child not linked to an organization' })

      const orgChildRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`)
      const orgChildSnap = await orgChildRef.get()
      if (!orgChildSnap.exists || orgChildSnap.data()?.parentUserId !== uid) {
        return reply.code(403).send({ error: 'Only the parent of this child can submit homework' })
      }

      const taskRef = db.doc(`${COLLECTIONS.CHILD_TASKS(childId)}/${taskId}`)
      const taskSnap = await taskRef.get()
      if (!taskSnap.exists) return reply.code(404).send({ error: 'Task not found' })

      const body = request.body as { submissionText?: string; fileUrl?: string }
      const now = admin.firestore.Timestamp.fromDate(new Date())
      const taskTitle = taskSnap.data()?.title || 'Task'
      const childName = childSnap.data()?.name || 'Child'

      await taskRef.update({
        status: 'submitted',
        submissionText: body.submissionText ?? null,
        fileUrl: body.fileUrl ?? null,
        submittedAt: now,
        updatedAt: now,
      })

      const specialistId = orgChildSnap.data()?.assignedSpecialistId
      if (specialistId) {
        dispatch({
          userId: specialistId,
          orgId,
          role: 'specialist',
          type: 'homework_submitted',
          category: 'assignments',
          title: '📎 New submission to review',
          body: `${childName}'s parent submitted "${taskTitle}" for review`,
          metadata: { childId, taskId, orgId },
          dedupKey: `homework_submitted:${taskId}`,
          channel: 'both',
          priority: 'high',
        }).catch(() => {})
      }

      return { ok: true, taskId, status: 'submitted', submittedAt: now.toDate() }
    } catch (error: any) {
      console.error('[PARENT_TASKS] Error submitting homework:', error)
      return reply.code(500).send({ error: 'Failed to submit homework', details: error.message })
    }
  })

  fastify.get<{
    Params: { childId: string }
    Querystring: { orgId?: string; month?: string }
  }>('/api/parent/children/:childId/billing', async (request, reply) => {
    try {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const uid = request.user.uid
      const { childId } = request.params
      const { orgId: qOrgId, month: qMonth } = request.query as {
        orgId?: string
        month?: string
      }

      const db = getFirestore()

      let orgId = qOrgId
      if (!orgId) {
        const childSnap = await db.doc(`${COLLECTIONS.CHILDREN}/${childId}`).get()
        orgId = childSnap.data()?.organizationId
      }
      if (!orgId) return reply.code(400).send({ error: 'orgId is required' })

      const orgChildRef = db.doc(`${COLLECTIONS.ORG_CHILDREN(orgId)}/${childId}`)
      const orgChildSnap = await orgChildRef.get()
      if (!orgChildSnap.exists || orgChildSnap.data()?.parentUserId !== uid) {
        return reply.code(403).send({ error: 'Access denied' })
      }

      const month = qMonth || currentMonthStr()
      const assignedAt: FirebaseFirestore.Timestamp | undefined = orgChildSnap.data()?.assignedAt
      const billingDay = assignedAt ? assignedAt.toDate().getDate() : 1

      const [year, mon] = month.split('-').map(Number)
      const dueDate = new Date(year, mon - 1, billingDay)
      const today = new Date()
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

      const feeDocId = `${month}_${childId}`
      const feeSnap = await db.doc(`${COLLECTIONS.ORG_MONTHLY_FEES(orgId)}/${feeDocId}`).get()
      const feeData = feeSnap.exists ? feeSnap.data()! : null
      const feeStatus = feeData?.status || 'pending'

      let billingStatus: 'paid' | 'overdue' | 'due_soon' | 'upcoming'
      if (feeStatus === 'paid') {
        billingStatus = 'paid'
      } else if (daysUntilDue < 0) {
        billingStatus = 'overdue'
      } else if (daysUntilDue <= 3) {
        billingStatus = 'due_soon'
      } else {
        billingStatus = 'upcoming'
      }

      return {
        ok: true,
        childId,
        orgId,
        month,
        billingDay,
        dueDate: dueDate.toISOString().split('T')[0],
        daysUntilDue,
        billingStatus,
        amount: feeData?.amount ?? 0,
        currency: feeData?.currency || 'KGS',
        paidAt: feeData?.paidAt?.toDate?.()?.toISOString() || null,
        note: feeData?.note || null,
      }
    } catch (error: any) {
      console.error('[PARENT_TASKS] Error getting billing:', error)
      return reply.code(500).send({ error: 'Failed to get billing status', details: error.message })
    }
  })
}
