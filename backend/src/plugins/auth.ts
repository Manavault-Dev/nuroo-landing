import { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { getAuth } from '../firebaseAdmin.js'
import type { AuthenticatedUser } from '../types.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

export const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null)

  fastify.addHook('preHandler', async (request: FastifyRequest, reply) => {
    if (request.url === '/health' || request.method === 'OPTIONS') {
      return
    }

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing or invalid Authorization header' })
    }

    try {
      const token = authHeader.substring(7)
      const auth = getAuth()
      const decodedToken = await auth.verifyIdToken(token)
      request.user = { uid: decodedToken.uid, email: decodedToken.email }
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired token' })
    }
  })
}
