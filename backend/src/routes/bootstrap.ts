import { FastifyPluginAsync } from 'fastify'
import { getAuth } from '../firebaseAdmin.js'
import { config } from '../config.js'
import { z } from 'zod'

const bootstrapSuperAdminSchema = z.object({
  email: z.string().email(),
  secretKey: z.string().min(1),
})

/**
 * Bootstrap endpoint for initial Super Admin setup
 * This is a one-time setup endpoint that requires a secret key
 * After first Super Admin is set, use /admin/super-admin instead
 */
export const bootstrapRoute: FastifyPluginAsync = async (fastify) => {
  // POST /bootstrap/super-admin - One-time setup for first Super Admin
  fastify.post<{ Body: z.infer<typeof bootstrapSuperAdminSchema> }>(
    '/bootstrap/super-admin',
    async (request, reply) => {
      const body = bootstrapSuperAdminSchema.parse(request.body)
      const { email, secretKey } = body

      // Check secret key (set in environment variable)
      // In development, use a default key. In production, MUST be set in .env
      const expectedSecretKey = config.BOOTSTRAP_SECRET_KEY || 
        (config.NODE_ENV === 'production' ? null : 'dev-bootstrap-key-2024')
      
      if (!expectedSecretKey) {
        return reply.code(500).send({ 
          error: 'BOOTSTRAP_SECRET_KEY not configured. Set it in .env file for production.' 
        })
      }
      
      if (secretKey !== expectedSecretKey) {
        return reply.code(403).send({ error: 'Invalid secret key' })
      }

      // In production, you might want to check if Super Admin already exists
      // and prevent creating more than one without proper auth
      if (config.NODE_ENV === 'production') {
        try {
          const auth = getAuth()
          const listUsersResult = await auth.listUsers(10)
          const hasSuperAdmin = listUsersResult.users.some(
            user => user.customClaims?.superAdmin === true
          )
          
          if (hasSuperAdmin) {
            return reply.code(403).send({ 
              error: 'Super Admin already exists. Use /admin/super-admin endpoint instead.' 
            })
          }
        } catch (err) {
          console.error('Error checking existing Super Admins:', err)
        }
      }

      try {
        const auth = getAuth()
        const user = await auth.getUserByEmail(email)

        console.log(`🔧 [BOOTSTRAP] Setting super admin for: ${email} (${user.uid})`)

        await auth.setCustomUserClaims(user.uid, { superAdmin: true })

        return {
          ok: true,
          message: `Super Admin claim set for ${email}`,
          uid: user.uid,
          email: user.email,
          note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
          warning: config.NODE_ENV === 'production' 
            ? 'Make sure to set a strong BOOTSTRAP_SECRET_KEY in production'
            : undefined,
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({ error: `User with email ${email} not found` })
        }
        
        // If permission error, provide helpful message
        if (error.code === 'auth/internal-error' || error.message?.includes('PERMISSION_DENIED')) {
          return reply.code(500).send({ 
            error: 'Service account lacks permissions. Please use Firebase Console or fix service account permissions.',
            details: 'The Firebase Admin service account needs "Service Usage Consumer" role in Google Cloud Console.'
          })
        }
        
        throw error
      }
    }
  )
}
