import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { initializeFirebaseAdmin, getAuth } from './firebaseAdmin.js'
import type { AuthenticatedUser } from './types.js'
import { healthRoute } from './routes/health.js'
import { meRoute } from './routes/me.js'
import { joinRoute } from './routes/join.js'
import { sessionRoute } from './routes/session.js'
import { childrenRoute } from './routes/children.js'
import { notesRoute } from './routes/notes.js'
import { invitesRoute } from './routes/invites.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  initializeFirebaseAdmin()

  await fastify.register(cors, {
    origin: config.NODE_ENV === 'production' 
      ? ['https://usenuroo.com'] 
      : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  })

  fastify.addHook('preHandler', async (request, reply) => {
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

  await fastify.register(healthRoute)
  await fastify.register(meRoute)
  await fastify.register(joinRoute)
  await fastify.register(sessionRoute)
  await fastify.register(childrenRoute)
  await fastify.register(notesRoute)
  await fastify.register(invitesRoute)

  return fastify
}

async function start() {
  try {
    const server = await buildServer()
    const port = parseInt(config.PORT, 10)
    const host = config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'
    await server.listen({ port, host })
    console.log(`🚀 Server running at http://${host}:${port}`)
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

start()
