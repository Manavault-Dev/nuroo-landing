import { FastifyPluginAsync } from 'fastify'

import { getAuth } from '../infrastructure/database/firebase.js'
import { config } from '../config/index.js'
import { z } from 'zod'

const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

const setSuperAdminSchema = z.object({
  email: z.string().email(),
})

function normalizeEmail(email: string | undefined): string {
  return (email || '').toLowerCase().trim()
}

function isWhitelisted(email: string | undefined): boolean {
  const normalizedEmail = normalizeEmail(email)
  return DEV_SUPER_ADMIN_WHITELIST.some(
    (whitelistedEmail) => normalizeEmail(whitelistedEmail) === normalizedEmail
  )
}

export const devRoute: FastifyPluginAsync = async (fastify) => {
  const isProduction = config.NODE_ENV === 'production'

  if (!isProduction) {
    fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
      '/dev/set-super-admin',
      async (request, reply) => {
        const body = setSuperAdminSchema.parse(request.body)
        const { email } = body

        try {
          const auth = getAuth()
          const user = await auth.getUserByEmail(email)

          try {
            await auth.setCustomUserClaims(user.uid, { superAdmin: true })

            return {
              ok: true,
              message: `Super Admin claim set for ${email}`,
              uid: user.uid,
              note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
            }
          } catch (claimError: any) {
            return {
              ok: true,
              message: `Super Admin access granted via dev whitelist for ${email}`,
              uid: user.uid,
              note: 'Custom claim could not be set, but user is added to dev whitelist. User must refresh their ID token (sign out and sign in) for the claim to take effect.',
              warning: 'Using dev whitelist - this only works in development mode',
            }
          }
        } catch (error: any) {
          if (error.code === 'auth/user-not-found') {
            return reply.code(404).send({
              error: `User with email ${email} not found`,
            })
          }
          throw error
        }
      }
    )
  }

  fastify.get('/dev/check-super-admin', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const userEmail = request.user.email
      const isSuperAdmin = request.user.claims?.superAdmin === true
      const isWhitelistedUser = !isProduction && isWhitelisted(userEmail)

      return {
        uid: request.user.uid,
        email: userEmail,
        isSuperAdmin: isSuperAdmin || isWhitelistedUser,
        claims: request.user.claims,
        isWhitelisted: isWhitelistedUser,
        environment: config.NODE_ENV,
        note: isWhitelistedUser ? 'Using dev whitelist (custom claim not set)' : undefined,
      }
    } catch (error: any) {
      console.error('[DEV] Error checking super admin:', error)
      return reply.code(500).send({
        error: 'Failed to check super admin status',
        details: error.message,
      })
    }
  })
}

export { DEV_SUPER_ADMIN_WHITELIST }
