import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { getAuth } from '../infrastructure/database/firebase.js'
import { config } from '../config/index.js'

const MAX_USERS_CHECK = 10

const bootstrapSuperAdminSchema = z.object({
  email: z.string().email(),
  secretKey: z.string().min(1),
})

const DEFAULT_DEV_SECRET_KEY = 'dev-bootstrap-key-2024'

function getExpectedSecretKey(): string | null {
  if (config.BOOTSTRAP_SECRET_KEY) {
    return config.BOOTSTRAP_SECRET_KEY
  }
  return config.NODE_ENV === 'production' ? null : DEFAULT_DEV_SECRET_KEY
}

async function checkExistingSuperAdmin(auth: any): Promise<boolean> {
  try {
    const listUsersResult = await auth.listUsers(MAX_USERS_CHECK)
    return listUsersResult.users.some((user) => user.customClaims?.superAdmin === true)
  } catch {
    return false
  }
}

function isPermissionError(error: any): boolean {
  return error.code === 'auth/internal-error' || error.message?.includes('PERMISSION_DENIED')
}

export const bootstrapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof bootstrapSuperAdminSchema> }>(
    '/bootstrap/super-admin',
    async (request, reply) => {
      const body = bootstrapSuperAdminSchema.parse(request.body)
      const { email, secretKey } = body

      const expectedSecretKey = getExpectedSecretKey()

      if (!expectedSecretKey) {
        return reply.code(500).send({
          error: 'BOOTSTRAP_SECRET_KEY not configured. Set it in .env file for production.',
        })
      }

      if (secretKey !== expectedSecretKey) {
        return reply.code(403).send({ error: 'Invalid secret key' })
      }

      if (config.NODE_ENV === 'production') {
        const auth = getAuth()
        const hasSuperAdmin = await checkExistingSuperAdmin(auth)

        if (hasSuperAdmin) {
          return reply.code(403).send({
            error: 'Super Admin already exists. Use /admin/super-admin endpoint instead.',
          })
        }
      }

      try {
        const auth = getAuth()
        const user = await auth.getUserByEmail(email)

        await auth.setCustomUserClaims(user.uid, { superAdmin: true })

        return {
          ok: true,
          message: `Super Admin claim set for ${email}`,
          uid: user.uid,
          email: user.email,
          note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
          warning:
            config.NODE_ENV === 'production'
              ? 'Make sure to set a strong BOOTSTRAP_SECRET_KEY in production'
              : undefined,
        }
      } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
          return reply.code(404).send({
            error: `User with email ${email} not found`,
          })
        }

        if (isPermissionError(error)) {
          return reply.code(500).send({
            error:
              'Service account lacks permissions. Please use Firebase Console or fix service account permissions.',
            details:
              'The Firebase Admin service account needs "Service Usage Consumer" role in Google Cloud Console.',
          })
        }

        throw error
      }
    }
  )
}
