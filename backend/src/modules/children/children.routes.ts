import { FastifyPluginAsync } from 'fastify'
import { requireOrgMember, requireChildAccess } from '../../shared/guards/index.js'
import { listChildren, getChildDetailById, getTimeline } from './children.service.js'

export const childrenRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /orgs/:orgId/children - List children in organization
  fastify.get<{ Params: { orgId: string } }>('/orgs/:orgId/children', async (request, reply) => {
    const { orgId } = request.params
    const member = await requireOrgMember(request, reply, orgId)
    const { uid } = request.user!

    const children = await listChildren(orgId, member.role, uid)
    return children
  })

  // GET /orgs/:orgId/children/:childId - Get child detail
  fastify.get<{ Params: { orgId: string; childId: string } }>(
    '/orgs/:orgId/children/:childId',
    async (request, reply) => {
      const { orgId, childId } = request.params

      await requireOrgMember(request, reply, orgId)
      await requireChildAccess(request, reply, orgId, childId)

      const detail = await getChildDetailById(orgId, childId)

      if (!detail) {
        return reply.code(404).send({ error: 'Child not found' })
      }

      return detail
    }
  )

  // GET /orgs/:orgId/children/:childId/timeline - Get child timeline
  fastify.get<{
    Params: { orgId: string; childId: string }
    Querystring: { days?: string }
  }>('/orgs/:orgId/children/:childId/timeline', async (request, reply) => {
    const { orgId, childId } = request.params
    const daysParam = parseInt(request.query.days || '30', 10)
    const days = Math.min(Math.max(daysParam, 7), 90)

    await requireOrgMember(request, reply, orgId)
    await requireChildAccess(request, reply, orgId, childId)

    const timeline = await getTimeline(childId, days)
    return timeline
  })
}
