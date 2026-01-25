import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrgMember } from '../../shared/guards/index.js'
import {
  createSpecialistOrgInvite,
  joinOrganization,
  acceptInviteCode,
  createSpecialistParentInvite,
  validateParentInviteCode,
  useParentInviteCode,
} from './invites.service.js'
import {
  createOrgInviteSchema,
  joinOrgSchema,
  acceptInviteSchema,
} from './invites.schema.js'

export const invitesRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /orgs/:orgId/invites - Create org invite (admin only)
  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createOrgInviteSchema> }>(
    '/orgs/:orgId/invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { orgId } = request.params
      const { uid } = request.user

      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can create invite codes' })
      }

      const body = createOrgInviteSchema.parse(request.body)
      const result = await createSpecialistOrgInvite(orgId, uid, body)

      return { ok: true, ...result }
    }
  )

  // POST /join - Join organization with invite code
  fastify.post<{ Body: z.infer<typeof joinOrgSchema> }>(
    '/join',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid, email } = request.user
      const body = joinOrgSchema.parse(request.body)

      const result = await joinOrganization(uid, email || '', body)

      if ('error' in result) {
        return reply.code(result.code || 400).send({ error: result.error })
      }

      return result
    }
  )

  // POST /invites/accept - Accept invite code
  fastify.post<{ Body: z.infer<typeof acceptInviteSchema> }>(
    '/invites/accept',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid, email } = request.user
      const body = acceptInviteSchema.parse(request.body)

      const result = await acceptInviteCode(uid, email || '', body)

      if ('error' in result) {
        return reply.code(result.code || 400).send({ error: result.error })
      }

      return result
    }
  )

  // POST /specialists/invites - Create parent invite
  fastify.post(
    '/specialists/invites',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        const { uid, email } = request.user
        const result = await createSpecialistParentInvite(uid, email || '')
        return result
      } catch (error: any) {
        console.error('Error creating parent invite:', error)
        return reply.code(500).send({ error: error.message || 'Failed to create invite code' })
      }
    }
  )

  // POST /api/org/parent-invites/validate - Validate parent invite
  fastify.post<{
    Body?: { inviteCode?: string; code?: string }
    Querystring?: { inviteCode?: string; code?: string }
  }>(
    '/api/org/parent-invites/validate',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      try {
        let inviteCode: string | undefined

        const body = request.body as any
        if (body) {
          inviteCode = body.inviteCode || body.code || body.invite_code
        }

        if (!inviteCode) {
          const query = request.query as any
          inviteCode = query?.inviteCode || query?.code || query?.invite_code
        }

        if (!inviteCode || typeof inviteCode !== 'string') {
          return reply.code(400).send({ error: 'Invite code is required' })
        }

        const result = await validateParentInviteCode(inviteCode)

        if ('error' in result) {
          return reply.code(result.code || 400).send({ error: result.error })
        }

        return result
      } catch (error: any) {
        console.error('Error validating parent invite:', error)
        return reply.code(500).send({ error: error.message || 'Failed to validate invite code' })
      }
    }
  )

  // POST /api/org/parent-invites/use - Use parent invite
  fastify.post<{
    Body?: { inviteCode?: string; code?: string; childId?: string }
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>(
    '/api/org/parent-invites/use',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid: parentUid } = request.user

      try {
        let inviteCode: string | undefined
        let childId: string | undefined

        const body = request.body as any
        if (body) {
          inviteCode = body.inviteCode || body.code || body.invite_code
          childId = body.childId || body.child_id
        }

        if (!inviteCode || !childId) {
          const query = request.query as any
          if (!inviteCode) {
            inviteCode = query?.inviteCode || query?.code || query?.invite_code
          }
          if (!childId) {
            childId = query?.childId || query?.child_id
          }
        }

        if (!inviteCode || typeof inviteCode !== 'string') {
          return reply.code(400).send({ error: 'Invite code is required' })
        }

        if (!childId || typeof childId !== 'string') {
          return reply.code(400).send({ error: 'Child ID is required' })
        }

        const result = await useParentInviteCode(inviteCode, childId, parentUid)

        if ('error' in result) {
          return reply.code(result.code || 400).send({ error: result.error })
        }

        return result
      } catch (error: any) {
        console.error('Error using parent invite:', error)
        return reply.code(500).send({ error: error.message || 'Failed to use invite code' })
      }
    }
  )

  // POST /api/org/parent-invites/accept - Accept parent invite (alias for /use)
  fastify.post<{
    Body?: { inviteCode?: string; code?: string; childId?: string }
    Querystring?: { inviteCode?: string; code?: string; childId?: string }
  }>(
    '/api/org/parent-invites/accept',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { uid: parentUid } = request.user

      console.log('/api/org/parent-invites/accept called', {
        body: request.body,
        query: request.query,
        hasUser: !!request.user,
        parentUid,
      })

      try {
        let inviteCode: string | undefined
        let childId: string | undefined

        const body = request.body as any
        if (body) {
          inviteCode = body.inviteCode || body.code || body.invite_code
          childId = body.childId || body.child_id
        }

        if (!inviteCode || !childId) {
          const query = request.query as any
          if (!inviteCode) {
            inviteCode = query?.inviteCode || query?.code || query?.invite_code
          }
          if (!childId) {
            childId = query?.childId || query?.child_id
          }
        }

        if (!inviteCode || typeof inviteCode !== 'string') {
          return reply.code(400).send({ error: 'Invite code is required' })
        }

        if (!childId || typeof childId !== 'string') {
          return reply.code(400).send({ error: 'Child ID is required' })
        }

        const result = await useParentInviteCode(inviteCode, childId, parentUid)

        if ('error' in result) {
          return reply.code(result.code || 400).send({ error: result.error })
        }

        return result
      } catch (error: any) {
        console.error('[ACCEPT] Error accepting parent invite:', error)
        return reply.code(500).send({ error: error.message || 'Failed to accept invite code' })
      }
    }
  )
}
