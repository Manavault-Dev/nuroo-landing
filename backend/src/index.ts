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
import { adminRoute } from './routes/admin.js'
import { invitesAcceptRoute } from './routes/invitesAccept.js'
import { devRoute } from './routes/dev.js'
import { parentsRoute } from './routes/parents.js'
import { assignmentsRoute } from './routes/assignments.js'
import { superAdminManagementRoute } from './routes/superAdminManagement.js'
import { bootstrapRoute } from './routes/bootstrap.js'
import { teamRoute } from './routes/team.js'
import { groupsRoute } from './routes/groups.js'
import { contentRoute } from './routes/content.js'

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
    origin:
      config.NODE_ENV === 'production'
        ? ['https://usenuroo.com']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'],
    credentials: true,
  })

  fastify.addHook('preHandler', async (request, reply) => {
    // Allow health check and OPTIONS without auth
    if (request.url === '/health' || request.method === 'OPTIONS') {
      return
    }

    // Allow dev endpoints without auth in dev mode (except /dev/check-super-admin)
    if (config.NODE_ENV !== 'production' && request.url.startsWith('/dev/set-super-admin')) {
      return
    }

    // Allow bootstrap endpoint (requires secret key)
    if (request.url.startsWith('/bootstrap/')) {
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
      request.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        claims: decodedToken,
      }
    } catch (error: any) {
      console.error('❌ [AUTH] Token verification failed:', error.message)
      console.error('❌ [AUTH] Error code:', error.code)
      return reply.code(401).send({ error: 'Invalid or expired token', details: error.message })
    }
  })

  await fastify.register(healthRoute)
  await fastify.register(meRoute)
  await fastify.register(joinRoute)
  await fastify.register(sessionRoute)
  await fastify.register(childrenRoute)
  await fastify.register(notesRoute)
  await fastify.register(invitesRoute)
  await fastify.register(adminRoute)
  await fastify.register(invitesAcceptRoute)
  await fastify.register(devRoute)
  await fastify.register(parentsRoute)
  await fastify.register(assignmentsRoute)
  await fastify.register(superAdminManagementRoute)
  await fastify.register(bootstrapRoute)
  await fastify.register(teamRoute)
  await fastify.register(groupsRoute)
  await fastify.register(contentRoute)

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

void start()
