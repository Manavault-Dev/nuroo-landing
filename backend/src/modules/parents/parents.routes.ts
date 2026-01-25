import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrgAdmin } from '../../shared/guards/index.js'
import { listParents, addParent, getParent, editParent, removeParent } from './parents.service.js'
import { createParentSchema, updateParentSchema } from './parents.schema.js'

export const parentsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /orgs/:orgId/parents - List all parent contacts
  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/parents',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      return listParents(orgId)
    }
  )

  // POST /orgs/:orgId/parents - Create a parent contact
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createParentSchema> }>(
    '/orgs/:orgId/parents',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const body = createParentSchema.parse(request.body)
      return addParent(orgId, body)
    }
  )

  // PATCH /orgs/:orgId/parents/:parentId - Update a parent contact
  fastify.patch<{ Params: { orgId: string; parentId: string }; Body: z.infer<typeof updateParentSchema> }>(
    '/orgs/:orgId/parents/:parentId',
    async (request, reply) => {
      const { orgId, parentId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const parent = await getParent(orgId, parentId)
      if (!parent) {
        return reply.code(404).send({ error: 'Parent contact not found' })
      }

      const body = updateParentSchema.parse(request.body)
      return editParent(orgId, parentId, body)
    }
  )

  // DELETE /orgs/:orgId/parents/:parentId - Delete a parent contact
  fastify.delete<{ Params: { orgId: string; parentId: string } }>(
    '/orgs/:orgId/parents/:parentId',
    async (request, reply) => {
      const { orgId, parentId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const parent = await getParent(orgId, parentId)
      if (!parent) {
        return reply.code(404).send({ error: 'Parent contact not found' })
      }

      return removeParent(orgId, parentId)
    }
  )
}
