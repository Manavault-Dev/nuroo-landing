import { FastifyPluginAsync } from 'fastify'
import {
  listChildSpecialists,
  listChildNotes,
  listParentOrganizations,
  listParentLinkedChildren,
} from './parent.service.js'

export const parentApiRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/parent/children/:childId/specialists - List specialists with access to child
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
      } catch (error: any) {
        console.error('Error getting child specialists:', error)
        if (error.message?.includes('Access denied')) {
          return reply.code(403).send({ error: error.message })
        }
        return reply.code(500).send({ error: error.message || 'Failed to get specialists' })
      }
    }
  )

  // GET /api/parent/children/:childId/notes - Get specialist notes visible to parent
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
      } catch (error: any) {
        console.error('Error getting child notes:', error)
        if (error.message?.includes('Access denied')) {
          return reply.code(403).send({ error: error.message })
        }
        return reply.code(500).send({ error: error.message || 'Failed to get notes' })
      }
    }
  )

  // GET /api/parent/organizations - List organizations parent is linked to
  fastify.get('/api/parent/organizations', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid: parentUid } = request.user

    try {
      const organizations = await listParentOrganizations(parentUid)
      return { ok: true, organizations }
    } catch (error: any) {
      console.error('Error getting parent organizations:', error)
      return reply.code(500).send({ error: error.message || 'Failed to get organizations' })
    }
  })

  // GET /api/parent/children - List children linked to parent (via specialist invites)
  fastify.get('/api/parent/children', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid: parentUid } = request.user

    try {
      const childIds = await listParentLinkedChildren(parentUid)
      return { ok: true, childIds }
    } catch (error: any) {
      console.error('Error getting parent children:', error)
      return reply.code(500).send({ error: error.message || 'Failed to get children' })
    }
  })
}
