import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { getProfile, updateProfile, getSession } from './users.service.js'
import { updateProfileSchema } from './users.types.js'

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /me - Get current user's profile
  fastify.get('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid, email } = request.user
    console.log(`[ME] Getting profile for uid: ${uid}`)

    const profile = await getProfile(uid, email)
    return profile
  })

  // POST /me - Update profile
  fastify.post<{ Body: z.infer<typeof updateProfileSchema> }>('/me', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid, email } = request.user
    const body = updateProfileSchema.parse(request.body)

    const result = await updateProfile(uid, email, body)
    return { ok: true, ...result }
  })

  // GET /session - Get session status
  fastify.get('/session', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { uid } = request.user
    const session = await getSession(uid)

    return { ok: true, ...session }
  })
}
