import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import {
  fetchAssignedChildren,
  groupChildrenByParent,
  enrichChildrenWithDetails,
  buildParentConnection,
  disconnectParentFromOrg,
} from './children.service.js'

export const childrenConnectionsRoute: import('fastify').FastifyPluginAsync = async (fastify) => {
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
      fastify.log.error({ err: error }, 'Route handler failed')
      return reply.code(500).send({
        error: 'Failed to fetch connections',
        details: error instanceof Error ? error.message : '',
      })
    }
  })
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
        const result = await disconnectParentFromOrg(db, orgId, parentUserId)
        return { ok: true, ...result }
      } catch (error: unknown) {
        fastify.log.error({ err: error }, 'Route handler failed')
        return reply.code(500).send({
          error: 'Failed to disconnect parent',
          details: error instanceof Error ? error.message : '',
        })
      }
    }
  )
}
