import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

import { getAuth } from '../infrastructure/database/firebase.js'
import { requireSuperAdmin } from '../plugins/superAdmin.js'

const MAX_USERS_PER_PAGE = 1000

const setSuperAdminSchema = z.object({
  email: z.string().email(),
})

const removeSuperAdminSchema = z.object({
  uid: z.string().min(1),
})

function isPermissionError(error: any): boolean {
  return (
    error.code === 'auth/internal-error' ||
    error.message?.includes('PERMISSION_DENIED') ||
    error.code === 7
  )
}

function buildSuperAdminClaim() {
  return { superAdmin: true }
}

function removeSuperAdminClaim(currentClaims: Record<string, unknown>) {
  const updatedClaims = { ...currentClaims }
  delete updatedClaims.superAdmin
  return updatedClaims
}

function transformSuperAdmin(user: any) {
  return {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || null,
    createdAt: user.metadata.creationTime,
    lastSignIn: user.metadata.lastSignInTime,
  }
}

function buildFallbackSuperAdmin(currentUser: { uid: string; email: string | undefined }) {
  return {
    uid: currentUser.uid,
    email: currentUser.email || '',
    displayName: null,
    createdAt: '',
    lastSignIn: null,
  }
}

async function listSuperAdminsWithFallback(
  auth: any,
  currentUser: { uid: string; email: string | undefined }
) {
  try {
    const listUsersResult = await auth.listUsers(MAX_USERS_PER_PAGE)
    return listUsersResult.users
      .filter((user) => user.customClaims?.superAdmin === true)
      .map(transformSuperAdmin)
  } catch (error: any) {
    if (isPermissionError(error)) {
      return [buildFallbackSuperAdmin(currentUser)]
    }
    throw error
  }
}

export const superAdminManagementRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: z.infer<typeof setSuperAdminSchema> }>(
    '/admin/super-admin',
    async (request, reply) => {
      await requireSuperAdmin(request, reply)

      const body = setSuperAdminSchema.parse(request.body)
      const { email } = body

      try {
        const auth = getAuth()
        const user = await auth.getUserByEmail(email)

        await auth.setCustomUserClaims(user.uid, buildSuperAdminClaim())

        return {
          ok: true,
          message: `Super Admin rights granted to ${email}`,
          uid: user.uid,
          email: user.email,
          note: 'User must refresh their ID token (sign out and sign in) for the claim to take effect',
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

  fastify.delete<{ Params: { uid: string } }>('/admin/super-admin/:uid', async (request, reply) => {
    await requireSuperAdmin(request, reply)

    const { uid } = request.params

    if (uid === request.user!.uid) {
      return reply.code(400).send({
        error: 'Cannot remove Super Admin rights from yourself',
      })
    }

    try {
      const auth = getAuth()
      const user = await auth.getUser(uid)

      const currentClaims = user.customClaims || {}

      if (!currentClaims.superAdmin) {
        return reply.code(400).send({ error: 'User is not a Super Admin' })
      }

      await auth.setCustomUserClaims(uid, removeSuperAdminClaim(currentClaims))

      return {
        ok: true,
        message: `Super Admin rights removed from ${user.email}`,
        uid,
        email: user.email,
      }
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        return reply.code(404).send({
          error: `User with uid ${uid} not found`,
        })
      }
      throw error
    }
  })

  fastify.get('/admin/super-admin', async (request, reply) => {
    try {
      await requireSuperAdmin(request, reply)

      const auth = getAuth()
      const currentUser = request.user!

      const superAdmins = await listSuperAdminsWithFallback(auth, currentUser)

      return {
        ok: true,
        superAdmins,
        count: superAdmins.length,
      }
    } catch (error: any) {
      console.error('[SUPER_ADMIN] Error listing super admins:', error)
      return reply.code(500).send({
        error: 'Failed to list Super Admins',
        message: error.message,
        code: error.code,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      })
    }
  })
}
