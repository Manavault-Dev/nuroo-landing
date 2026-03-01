import { FastifyPluginAsync } from 'fastify'
import admin from 'firebase-admin'
import { z } from 'zod'

import { getFirestore } from '../infrastructure/database/firebase.js'

const COLLECTIONS = {
  CHILDREN: 'children',
  CHILD_TASKS: (childId: string) => `children/${childId}/tasks`,
  ORG_CHILDREN: (orgId: string) => `organizations/${orgId}/children`,
} as const

const completeBodySchema = z.object({
  completed: z.boolean(),
})

/**
 * Parent-facing API: list tasks for a child and mark as complete.
 * Requires Firebase Bearer token; caller must be the parent of the child in the org.
 */
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
      await taskRef.update({
        status: completed ? 'completed' : 'pending',
        completedAt: completed ? now : null,
        updatedAt: now,
      })

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
}
