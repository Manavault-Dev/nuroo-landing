import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config.js'
import { initializeFirebaseAdmin, getAuth } from './infrastructure/database/firebase.js'
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
import { orgsRoute } from './routes/orgs.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

async function buildServer() {
  const isProduction = config.NODE_ENV === 'production'

  const fastify = Fastify({
    logger: { level: isProduction ? 'warn' : 'info' },
  })

  try {
    initializeFirebaseAdmin()
  } catch {
    // Will retry on first use (e.g. ADC in Cloud Run)
  }

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ]
  const productionOrigins = config.CORS_ORIGIN
    ? config.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['https://usenuroo.com']

  const corsOrigins = isProduction ? [...productionOrigins, ...defaultOrigins] : defaultOrigins

  await fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflight: true,
    strictPreflight: false,
  })

  fastify.addHook('preHandler', async (request, reply) => {
    const { url, method } = request

    if (url === '/health' || method === 'OPTIONS') return
    if (!isProduction && url.startsWith('/dev/set-super-admin')) return
    if (url.startsWith('/bootstrap/')) return
    if (url.startsWith('/api/parent/content/')) return
    if (url.startsWith('/api/parent/alphakids/')) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const token = authHeader.substring(7)
      const decoded = await getAuth().verifyIdToken(token)
      request.user = {
        uid: decoded.uid,
        email: decoded.email,
        claims: decoded,
      }
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })

  const routes = [
    healthRoute,
    meRoute,
    joinRoute,
    sessionRoute,
    childrenRoute,
    notesRoute,
    invitesRoute,
    adminRoute,
    invitesAcceptRoute,
    devRoute,
    parentsRoute,
    assignmentsRoute,
    superAdminManagementRoute,
    bootstrapRoute,
    teamRoute,
    groupsRoute,
    contentRoute,
    orgsRoute,
  ]

  for (const route of routes) {
    await fastify.register(route)
  }

  return fastify
}

async function start() {
  try {
    const server = await buildServer()
    const port = parseInt(process.env.PORT || config.PORT || '8080', 10)
    const host = config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'

    await server.listen({ port, host })
  } catch {
    process.exit(1)
  }
}

void start()
