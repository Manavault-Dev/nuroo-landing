import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireSuperAdmin } from '../../shared/guards/index.js'
import { config } from '../../config/index.js'
import {
  getOrganizations,
  createOrganization,
  createInvite,
  getInvites,
  getSuperAdmins,
  addSuperAdmin,
  removeSuperAdmin,
  bootstrapSuperAdmin,
  devSetSuperAdmin,
  checkSuperAdminStatus,
} from './admin.service.js'
import {
  createOrgSchema,
  createAdminInviteSchema,
  setSuperAdminSchema,
  bootstrapSuperAdminSchema,
} from './admin.schema.js'

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /admin/organizations - List organizations created by current Super Admin
  fastify.get('/admin/organizations', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const { uid } = request.user!

    try {
      return await getOrganizations(uid)
    } catch (error: any) {
      console.error('[ADMIN] Error fetching organizations:', error)
      return reply.code(500).send({
        error: 'Failed to fetch organizations',
        details: error.message,
      })
    }
  })

  // POST /admin/organizations - Create a new organization
  fastify.post<{ Body: z.infer<typeof createOrgSchema> }>(
    '/admin/organizations',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)
      const { uid } = request.user!
      const body = createOrgSchema.parse(request.body)

      const result = await createOrganization(uid, body)

      if ('error' in result) {
        return reply.code(result.code || 400).send({ error: result.error })
      }

      return result
    }
  )

  // POST /admin/invites - Create an invite code
  fastify.post<{ Body: z.infer<typeof createAdminInviteSchema> }>(
    '/admin/invites',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)
      const { uid } = request.user!
      const body = createAdminInviteSchema.parse(request.body)

      const result = await createInvite(uid, body)

      if ('error' in result) {
        return reply.code(Number(result.code) || 400).send({ error: result.error })
      }

      return result
    }
  )

  // GET /admin/invites - List invite codes
  fastify.get('/admin/invites', async (request, reply) => {
    await requireSuperAdmin(request, reply)
    const { uid } = request.user!

    return getInvites(uid)
  })

  // GET /admin/super-admin - List all Super Admins
  fastify.get('/admin/super-admin', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      return await getSuperAdmins()
    } catch (error: any) {
      console.error('Error listing super admins:', error)
      return reply.code(500).send({ error: 'Failed to list Super Admins' })
    }
  })

  // POST /admin/super-admin - Grant Super Admin rights
  fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
    '/admin/super-admin',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)
      const body = setSuperAdminSchema.parse(request.body)

      try {
        return await addSuperAdmin(request.user!.uid, body)
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with email ${body.email} not found` })
        }
        throw error
      }
    }
  )

  // DELETE /admin/super-admin/:uid - Remove Super Admin rights
  fastify.delete<{ Params: { uid: string } }>(
    '/admin/super-admin/:uid',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)
      const { uid } = request.params

      try {
        const result = await removeSuperAdmin(request.user!.uid, uid)

        if ('error' in result) {
          return reply.code(result.code || 400).send({ error: result.error })
        }

        return result
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with uid ${uid} not found` })
        }
        throw error
      }
    }
  )

  // POST /bootstrap/super-admin - One-time setup for first Super Admin
  fastify.post<{ Body: z.infer<typeof bootstrapSuperAdminSchema> }>(
    '/bootstrap/super-admin',
    async (request, reply) => {
      const body = bootstrapSuperAdminSchema.parse(request.body)

      try {
        const result = await bootstrapSuperAdmin(body)

        if ('error' in result) {
          return reply.code(result.code || 400).send({ error: result.error })
        }

        return result
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with email ${body.email} not found` })
        }

        if (error.code === 'auth/internal-error' || error.message?.includes('PERMISSION_DENIED')) {
          return reply.code(500).send({
            error: 'Service account lacks permissions. Please use Firebase Console or fix service account permissions.',
            details: 'The Firebase Admin service account needs "Service Usage Consumer" role in Google Cloud Console.',
          })
        }

        throw error
      }
    }
  )

  // Dev-only routes
  if (config.NODE_ENV !== 'production') {
    // POST /dev/set-super-admin - Set super admin claim (DEV ONLY)
    fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
      '/dev/set-super-admin',
      async (request, reply) => {
        const body = setSuperAdminSchema.parse(request.body)

        try {
          return await devSetSuperAdmin(body.email)
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            return reply.code(404).send({ error: `User with email ${body.email} not found` })
          }
          throw error
        }
      }
    )

    // GET /dev/check-super-admin - Check if current user is super admin (DEV ONLY)
    fastify.get('/dev/check-super-admin', async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      return checkSuperAdminStatus(
        request.user.uid,
        request.user.email,
        request.user.claims
      )
    })
  }
}
