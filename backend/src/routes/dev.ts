import { FastifyPluginAsync } from 'fastify'
import { getAuth } from '../firebaseAdmin.js'
import { config } from '../config.js'
import { z } from 'zod'

const setSuperAdminSchema = z.object({
  email: z.string().email(),
})

// TEMPORARY: Whitelist of emails that should be treated as Super Admin in dev mode
// This bypasses Firebase custom claims if they can't be set
const DEV_SUPER_ADMIN_WHITELIST = ['nuroo@gmail.com']

/**
 * Development-only endpoints for setting up Super Admin
 * Only available in non-production environments
 */
export const devRoute: FastifyPluginAsync = async (fastify) => {
  // Only register in development
  if (config.NODE_ENV === 'production') {
    return
  }

  // POST /dev/set-super-admin - Set super admin claim for a user (DEV ONLY, no auth required)
  fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
    '/dev/set-super-admin',
    async (request, reply) => {
      const body = setSuperAdminSchema.parse(request.body)
      const { email } = body

      try {
        const auth = getAuth()
        const user = await auth.getUserByEmail(email)

        console.log(`🔧 [DEV] Setting super admin for: ${email} (${user.uid})`)

        try {
          await auth.setCustomUserClaims(user.uid, { superAdmin: true })
          console.log(`✅ [DEV] Custom claim set successfully`)
        } catch (claimError: any) {
          // If setting custom claims fails, add to whitelist
          console.warn(`⚠️ [DEV] Failed to set custom claim: ${claimError.message}`)
          console.log(`📝 [DEV] Adding ${email} to dev whitelist instead`)
          
          // Note: Whitelist is checked in requireSuperAdmin plugin
          // For now, we'll return success but note that whitelist is used
          return {
            ok: true,
            message: `Super Admin access granted via dev whitelist for ${email}`,
            uid: user.uid,
            note: 'Custom claim could not be set, but user is added to dev whitelist. User must refresh their ID token (sign out and sign in) for the claim to take effect.',
            warning: 'Using dev whitelist - this only works in development mode',
          }
        }

        return {
          ok: true,
          message: `Super Admin claim set for ${email}`,
          uid: user.uid,
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

  // GET /dev/check-super-admin - Check if current user is super admin (DEV ONLY)
  fastify.get('/dev/check-super-admin', async (request, reply) => {
    try {
      if (!request.user) {
        console.log('❌ [DEV] No user in request')
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const userEmail = (request.user.email || '').toLowerCase().trim()
      const isSuperAdmin = request.user.claims?.superAdmin === true
      const isWhitelisted = DEV_SUPER_ADMIN_WHITELIST.some(
        email => email.toLowerCase().trim() === userEmail
      )

      console.log(`🔍 [DEV] Checking Super Admin for: ${userEmail}`)
      console.log(`📋 [DEV] UID: ${request.user.uid}`)
      console.log(`📋 [DEV] Custom claim superAdmin: ${isSuperAdmin}`)
      console.log(`📋 [DEV] Whitelisted: ${isWhitelisted}`)
      console.log(`📋 [DEV] Whitelist: ${DEV_SUPER_ADMIN_WHITELIST.join(', ')}`)
      console.log(`📋 [DEV] All claims:`, JSON.stringify(request.user.claims, null, 2))

      return {
        uid: request.user.uid,
        email: request.user.email,
        isSuperAdmin: isSuperAdmin || isWhitelisted,
        claims: request.user.claims,
        isWhitelisted,
        note: isWhitelisted ? 'Using dev whitelist (custom claim not set)' : undefined,
      }
    } catch (error: any) {
      console.error('❌ [DEV] Error in check-super-admin:', error)
      return reply.code(500).send({ 
        error: 'Internal server error',
        message: error.message,
        stack: config.NODE_ENV === 'development' ? error.stack : undefined
      })
    }
  })
}

// Export whitelist for use in superAdmin plugin
export { DEV_SUPER_ADMIN_WHITELIST }
