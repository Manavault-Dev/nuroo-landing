import { FastifyPluginAsync } from 'fastify'
import { getAuth } from '../firebaseAdmin.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'
import { z } from 'zod'

const setSuperAdminSchema = z.object({
  email: z.string().email(),
})

const removeSuperAdminSchema = z.object({
  uid: z.string().min(1),
})

/**
 * Super Admin management endpoints
 * Only Super Admins can manage other Super Admins
 */
export const superAdminManagementRoute: FastifyPluginAsync = async (fastify) => {
  // POST /admin/super-admin - Grant Super Admin rights to a user
  fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
    '/admin/super-admin',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      const body = setSuperAdminSchema.parse(request.body)
      const { email } = body

      try {
        const auth = getAuth()
        const user = await auth.getUserByEmail(email)

        console.log(`🔧 [SUPER_ADMIN] Granting super admin to: ${email} (${user.uid}) by ${request.user!.uid}`)

        await auth.setCustomUserClaims(user.uid, { superAdmin: true })

        return {
          ok: true,
          message: `Super Admin rights granted to ${email}`,
          uid: user.uid,
          email: user.email,
          note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with email ${email} not found` })
        }
        throw error
      }
    }
  )

  // DELETE /admin/super-admin/:uid - Remove Super Admin rights from a user
  fastify.delete<{ Params: { uid: string } }>(
    '/admin/super-admin/:uid',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      const { uid } = request.params

      // Prevent removing yourself
      if (uid === request.user!.uid) {
        return reply.code(400).send({ error: 'Cannot remove Super Admin rights from yourself' })
      }

      try {
        const auth = getAuth()
        const user = await auth.getUser(uid)

        // Check if user is actually a super admin
        const currentClaims = user.customClaims || {}
        if (!currentClaims.superAdmin) {
          return reply.code(400).send({ error: 'User is not a Super Admin' })
        }

        console.log(`🔧 [SUPER_ADMIN] Removing super admin from: ${user.email} (${uid}) by ${request.user!.uid}`)

        // Remove superAdmin claim (keep other claims)
        const updatedClaims = { ...currentClaims }
        delete updatedClaims.superAdmin
        await auth.setCustomUserClaims(uid, updatedClaims)

        return {
          ok: true,
          message: `Super Admin rights removed from ${user.email}`,
          uid,
          email: user.email,
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with uid ${uid} not found` })
        }
        throw error
      }
    }
  )

  // GET /admin/super-admin - List all Super Admins
  fastify.get('/admin/super-admin', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    try {
      const auth = getAuth()
      
      // List all users (this is expensive, but necessary for Super Admin management)
      // In production, you might want to cache this or use a different approach
      const listUsersResult = await auth.listUsers(1000) // Max 1000 users per page
      
      const superAdmins = listUsersResult.users
        .filter(user => user.customClaims?.superAdmin === true)
        .map(user => ({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || null,
          createdAt: user.metadata.creationTime,
          lastSignIn: user.metadata.lastSignInTime,
        }))

      console.log(`🔍 [SUPER_ADMIN] Found ${superAdmins.length} Super Admin(s)`)

      return {
        ok: true,
        superAdmins,
        count: superAdmins.length,
      }
    } catch (error: any) {
      console.error('Error listing super admins:', error)
      return reply.code(500).send({ error: 'Failed to list Super Admins' })
    }
  })
}
