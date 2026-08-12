/**
 * Audit log read routes — org admins can inspect activity history.
 *
 * GET /orgs/:orgId/audit?entityType=booking&entityId=bk_xxx&limit=50
 */

import type { FastifyPluginAsync } from 'fastify'
import { getFirestore } from '../database/firebase.js'
import { requireOrgMember } from '../auth/rbac.js'
import type { AuditEntry } from '../../domains/booking/types.js'

export const auditRoutes: FastifyPluginAsync = async (fastify) => {
  const db = getFirestore()

  fastify.get<{
    Params: { orgId: string }
    Querystring: { entityType?: string; entityId?: string; limit?: string }
  }>(
    '/orgs/:orgId/audit',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: 'Unauthorized' })
      const { orgId } = request.params
      const member = await requireOrgMember(request, reply, orgId)
      if (reply.sent) return
      if (member.role !== 'org_admin') return reply.code(403).send({ error: 'Forbidden' })

      const { entityType, entityId, limit: limitStr } = request.query as Record<string, string>
      const limit = Math.min(parseInt(limitStr ?? '50', 10) || 50, 200)

      let query = db
        .collection(`organizations/${orgId}/auditLog`)
        .orderBy('ts', 'desc')
        .limit(limit) as FirebaseFirestore.Query

      if (entityType) query = query.where('entityType', '==', entityType)
      if (entityId) query = query.where('entityId', '==', entityId)

      const snap = await query.get()
      const entries = snap.docs.map((d) => ({ id: d.id, ...(d.data() as AuditEntry) }))

      return { ok: true, entries }
    }
  )
}
