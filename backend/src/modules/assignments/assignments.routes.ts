import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrgAdmin } from '../../shared/guards/index.js'
import { assignChild, unassignChild } from './assignments.service.js'
import { assignChildSchema, unassignChildSchema } from './assignments.schema.js'

export const assignmentsRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /orgs/:orgId/assignments - Assign a child to a specialist
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof assignChildSchema> }>(
    '/orgs/:orgId/assignments',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const body = assignChildSchema.parse(request.body)
      const result = await assignChild(orgId, body)

      if ('error' in result) {
        return reply.code(result.code || 400).send({ error: result.error })
      }

      return result
    }
  )

  // DELETE /orgs/:orgId/assignments - Unassign a child from specialist
  fastify.delete<{ Params: { orgId: string }; Body: z.infer<typeof unassignChildSchema> }>(
    '/orgs/:orgId/assignments',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const body = unassignChildSchema.parse(request.body)
      const result = await unassignChild(orgId, body)

      if ('error' in result) {
        return reply.code(result.code || 400).send({ error: result.error })
      }

      return result
    }
  )
}
