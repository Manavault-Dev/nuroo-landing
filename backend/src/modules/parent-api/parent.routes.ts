import { FastifyPluginAsync } from 'fastify'
import { listChildSpecialists, listChildNotes, listParentLinkedChildren } from './parent.service.js'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { listInvoices } from '../../domains/payments/invoice.service.js'

export const parentApiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { childId: string } }>(
    '/api/parent/children/:childId/specialists',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid: parentUid } = request.user
      const { childId } = request.params

      try {
        const specialists = await listChildSpecialists(childId, parentUid)
        return { ok: true, specialists }
      } catch (error: unknown) {
        console.error('Error getting child specialists:', error)
        if (error instanceof Error && error.message?.includes('Access denied')) {
          return reply.code(403).send({ error: error.message })
        }
        return reply
          .code(500)
          .send({ error: error instanceof Error ? error.message : 'Failed to get specialists' })
      }
    }
  )

  fastify.get<{ Params: { childId: string } }>(
    '/api/parent/children/:childId/notes',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid: parentUid } = request.user
      const { childId } = request.params

      try {
        const notes = await listChildNotes(childId, parentUid)
        return { ok: true, notes }
      } catch (error: unknown) {
        console.error('Error getting child notes:', error)
        if (error instanceof Error && error.message?.includes('Access denied')) {
          return reply.code(403).send({ error: error.message })
        }
        return reply
          .code(500)
          .send({ error: error instanceof Error ? error.message : 'Failed to get notes' })
      }
    }
  )

  fastify.get('/api/parent/children', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid: parentUid } = request.user

    try {
      const childIds = await listParentLinkedChildren(parentUid)
      return { ok: true, childIds }
    } catch (error: unknown) {
      console.error('Error getting parent children:', error)
      return reply
        .code(500)
        .send({ error: error instanceof Error ? error.message : 'Failed to get children' })
    }
  })

  // GET /api/parent/invoices — parent sees their own invoices across all linked orgs
  fastify.get<{ Querystring: { orgId?: string; limit?: string } }>(
    '/api/parent/invoices',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid: parentUid } = request.user
      const { orgId, limit } = request.query
      const db = getFirestore()

      try {
        if (orgId) {
          // Query a specific org's invoices for this parent
          const invoices = await listInvoices(db, orgId, {
            parentId: parentUid,
            limit: limit ? parseInt(limit, 10) : 50,
          })
          return { ok: true, invoices }
        }

        // No orgId: discover all orgs the parent is linked to.
        // The mobile app stores linked orgs in users/{uid}.linkedOrganizationsById
        // (a map of { [key]: { orgId, orgName } }). We also check the legacy
        // parents/{uid}.linkedOrganizations array for back-compat.
        const [userSnap, parentSnap] = await Promise.all([
          db.doc(`users/${parentUid}`).get(),
          db.doc(`parents/${parentUid}`).get(),
        ])

        const linkedOrgs: string[] = []
        const seen = new Set<string>()

        const addOrg = (orgId: string) => {
          if (orgId && !seen.has(orgId)) {
            seen.add(orgId)
            linkedOrgs.push(orgId)
          }
        }

        if (userSnap.exists) {
          const userData = userSnap.data()!
          const byId = (userData.linkedOrganizationsById || {}) as Record<string, { orgId?: string }>
          for (const [key, val] of Object.entries(byId)) {
            addOrg(val.orgId || key)
          }
          const arr = (userData.linkedOrganizations || []) as Array<{ orgId: string }>
          arr.forEach((o) => addOrg(o.orgId))
        }

        if (parentSnap.exists) {
          const parentData = parentSnap.data()!
          const arr = (parentData.linkedOrganizations || []) as Array<{ orgId: string }>
          arr.forEach((o) => addOrg(o.orgId))
        }

        if (linkedOrgs.length === 0) {
          return { ok: true, invoices: [] }
        }

        const allInvoices = (
          await Promise.all(
            linkedOrgs.map((oid) =>
              listInvoices(db, oid, {
                parentId: parentUid,
                limit: limit ? parseInt(limit, 10) : 50,
              })
            )
          )
        ).flat()

        // Sort by createdAt desc
        allInvoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

        return { ok: true, invoices: allInvoices }
      } catch (error: unknown) {
        console.error('Error getting parent invoices:', error)
        return reply
          .code(500)
          .send({ error: error instanceof Error ? error.message : 'Failed to get invoices' })
      }
    }
  )
}
