import { getFirestore } from '../../infrastructure/database/firebase.js'
import {
  requireParentOrgAccess,
  listParentRoadmaps,
  getParentRoadmap,
  listParentTasks,
  getParentTask,
  completeParentTask,
  getRoadmapAssignmentsForParent,
  listAllParentTasks,
  listParentChildTasks,
  updateParentChildTask,
  getChildRoadmapAssignments,
  submitParentChildTask,
} from './orgContentParent.service.js'

export const orgParentContentRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
  async function checkParentAccess(
    request: any,
    reply: any,
    orgId: string
  ): Promise<{ parentUid: string; childIds: string[] } | false> {
    if (!request.user) {
      reply.code(401).send({ error: 'Unauthorized' })
      return false
    }
    const db = getFirestore()
    const result = await requireParentOrgAccess(db, request.user.uid, orgId)
    if (!result) {
      reply.code(401).send({
        error: 'Organization access invalid',
        message: 'You are not linked to this organization',
      })
      return false
    }
    return result
  }

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/content/roadmaps',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const result = await listParentRoadmaps(db, orgId)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list roadmaps' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; roadmapId: string } }>(
    '/orgs/:orgId/parent/content/roadmaps/:roadmapId',
    async (request, reply) => {
      try {
        const { orgId, roadmapId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        try {
          const roadmap = await getParentRoadmap(db, orgId, roadmapId)
          return { ok: true, roadmap }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to get roadmap' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/content/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const { ids } = request.query as { ids?: string }
        const result = await listParentTasks(db, orgId, ids)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/parent/content/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        try {
          const task = await getParentTask(db, orgId, taskId)
          return { ok: true, task }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to get task' })
      }
    }
  )

  fastify.post<{ Params: { orgId: string; taskId: string } }>(
    '/orgs/:orgId/parent/content/tasks/:taskId/complete',
    async (request, reply) => {
      try {
        const { orgId, taskId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        if (!request.user) return
        const db = getFirestore()
        const body =
          (request.body as { completed?: boolean; childId?: string; roadmapId?: string }) || {}
        const completed = body.completed !== false
        const childId = body.childId || access.childIds[0] || request.user.uid
        const roadmapId = body.roadmapId
        try {
          await completeParentTask(
            db,
            orgId,
            taskId,
            access.parentUid,
            childId,
            completed,
            roadmapId
          )
          return { ok: true, message: 'Task completion status updated' }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ ok: false, error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to update task completion' })
      }
    }
  )

  fastify.get<{
    Params: { orgId: string }
    Querystring: { roadmapId?: string }
  }>('/orgs/:orgId/parent/roadmap-assignments', async (request, reply) => {
    try {
      const { orgId } = request.params
      const filterRoadmapId = (request.query as { roadmapId?: string }).roadmapId
      const access = await checkParentAccess(request, reply, orgId)
      if (!access) return

      const db = getFirestore()
      const { childIds, parentUid } = access

      fastify.log.info(
        `[roadmap-assignments] orgId=${orgId} parentUid=${parentUid} childIds=${JSON.stringify(childIds)}`
      )

      const result = await getRoadmapAssignmentsForParent(
        db,
        orgId,
        childIds,
        parentUid,
        filterRoadmapId
      )
      return { ok: true, ...result }
    } catch (e: any) {
      return reply.code(500).send({ error: e?.message || 'Failed to list roadmap assignments' })
    }
  })

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parent/tasks',
    async (request, reply) => {
      try {
        const { orgId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return
        const db = getFirestore()
        const result = await listAllParentTasks(db, orgId, access.childIds)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list tasks' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const result = await listParentChildTasks(db, orgId, childId)
        return { ok: true, ...result }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list child tasks' })
      }
    }
  )

  fastify.patch<{ Params: { orgId: string; childId: string; taskId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks/:taskId',
    async (request, reply) => {
      try {
        const { orgId, childId, taskId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const body = (request.body as { completed?: boolean }) || {}
        const completed = body.completed !== false

        try {
          const status = await updateParentChildTask(db, childId, taskId, completed)
          return { ok: true, status }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to update task' })
      }
    }
  )

  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/parent/children/:childId/roadmap-assignments',
    async (request, reply) => {
      try {
        const { orgId, childId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const roadmapAssignments = await getChildRoadmapAssignments(db, orgId, childId)
        return { ok: true, roadmapAssignments }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to list roadmap assignments' })
      }
    }
  )

  fastify.patch<{ Params: { orgId: string; childId: string; taskId: string } }>(
    '/orgs/:orgId/parent/children/:childId/tasks/:taskId/submit',
    async (request, reply) => {
      try {
        const { orgId, childId, taskId } = request.params
        const access = await checkParentAccess(request, reply, orgId)
        if (!access) return

        if (!access.childIds.includes(childId)) {
          return reply.code(403).send({ error: 'Child does not belong to you' })
        }

        const db = getFirestore()
        const body = (request.body as { submissionText?: string; fileUrl?: string }) || {}

        try {
          const now = await submitParentChildTask(
            db,
            childId,
            taskId,
            body.submissionText,
            body.fileUrl
          )
          return { ok: true, taskId, submittedAt: now.toDate().toISOString() }
        } catch (e: any) {
          if (e.statusCode === 404) return reply.code(404).send({ error: e.message })
          throw e
        }
      } catch (e: any) {
        return reply.code(500).send({ error: e?.message || 'Failed to submit homework' })
      }
    }
  )
}
