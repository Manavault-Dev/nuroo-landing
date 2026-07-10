import { z } from 'zod'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireChildAccess } from '../../infrastructure/auth/rbac.js'
import { dispatch } from '../../modules/notifications/index.js'
import { createChildTask, listChildTasks } from './children.service.js'

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
})

export const childrenTasksRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        await requireOrgMember(request, reply, orgId)
        const resolvedChildId = await requireChildAccess(request, reply, orgId, childId)

        const db = getFirestore()
        const tasks = await listChildTasks(db, resolvedChildId)
        return { tasks }
      } catch (error: unknown) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to list tasks',
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
      const {
        id: taskId,
        taskData,
        now,
      } = await createChildTask(db, resolvedChildId, request.user.uid, title, description)

      const orgChildSnap = await db.doc(`organizations/${orgId}/children/${resolvedChildId}`).get()
      const parentUserId = orgChildSnap.data()?.parentUserId
      const childName: string = orgChildSnap.data()?.name || 'your child'
      if (parentUserId) {
        dispatch({
          userId: parentUserId,
          orgId,
          role: 'parent',
          type: 'task_assigned',
          category: 'assignments',
          title: 'New assignment',
          body: 'You have a new assignment.',
          metadata: { childId: resolvedChildId, taskId, orgId },
          dedupKey: `task_assigned:${resolvedChildId}:${taskId}`,
        }).catch(() => {})
      }

      return reply.code(201).send({
        id: taskId,
        ...taskData,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      })
    } catch (error: unknown) {
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to create task',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
}
