import Fastify from 'fastify'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import rateLimit from '@fastify/rate-limit'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { config } from './config/index.js'
import { initializeFirebaseAdmin, getAuth } from './infrastructure/database/firebase.js'
import type { AuthenticatedUser } from './types.js'

import { healthRoute } from './routes/health.js'
import { meRoute } from './routes/me.js'
import { joinRoute } from './routes/join.js'
import { sessionRoute } from './routes/session.js'
import { childrenRoute } from './routes/children.js'
import { notesRoute } from './routes/notes.js'
import { invitesRoute } from './routes/invites.js'
import { invitesAcceptRoute } from './routes/invitesAccept.js'
import { devRoute } from './routes/dev.js'
import { parentsRoute } from './routes/parents.js'
import { assignmentsRoute } from './routes/assignments.js'
import { bootstrapRoute } from './routes/bootstrap.js'
import { teamRoute } from './routes/team.js'
import { groupsRoute } from './routes/groups.js'
import { contentRoute } from './routes/content.js'
import { orgContentRoute } from './routes/orgContent.js'
import { orgsRoute } from './routes/orgs.js'
import { reportsRoute } from './routes/reports.js'
import { parentTasksRoute } from './routes/parentTasks.js'
import { paymentsRoutes } from './modules/payments/index.js'
import { parentApiRoutes } from './modules/parent-api/index.js'
import { aiAssistantRoutes, intentRoutes } from './modules/ai-assistant/index.js'
import { branchesRoute } from './routes/branches.js'
import { financeRoute } from './routes/finance.js'
import { brandingRoute } from './routes/branding.js'
import { parentAiRoute } from './routes/parentAi.js'
import { specialistAiRoute } from './routes/specialistAi.js'
import { pushTokensRoute } from './routes/pushTokens.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

const TOKEN_CACHE_TTL_MS = 5 * 60 * 1000
const TOKEN_CACHE_MAX_SIZE = 500
const tokenCache = new Map<string, { decoded: DecodedIdToken; expiresAt: number }>()

async function verifyIdTokenCached(token: string): Promise<DecodedIdToken> {
  const now = Date.now()
  const cached = tokenCache.get(token)

  if (cached && cached.expiresAt > now) {
    return cached.decoded
  }

  tokenCache.delete(token)
  const decoded = await getAuth().verifyIdToken(token)
  const tokenExpiresAt = decoded.exp ? decoded.exp * 1000 : now + TOKEN_CACHE_TTL_MS
  const expiresAt = Math.min(now + TOKEN_CACHE_TTL_MS, tokenExpiresAt)

  tokenCache.set(token, { decoded, expiresAt })
  if (tokenCache.size > TOKEN_CACHE_MAX_SIZE) {
    const oldestKey = tokenCache.keys().next().value
    if (oldestKey) tokenCache.delete(oldestKey)
  }

  return decoded
}

async function buildServer() {
  const isProduction = config.NODE_ENV === 'production'

  const fastify = Fastify({
    logger: { level: isProduction ? 'warn' : 'info' },
  })

  try {
    initializeFirebaseAdmin()
  } catch {
    // optional in some local/test setups; routes that need Firebase will fail fast
  }

  const defaultOrigins = [
    'http://localhost:3000',
    'http://localhost:3101',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3101',
  ]
  const productionOrigins = config.CORS_ORIGIN
    ? config.CORS_ORIGIN.split(',').map((origin) => origin.trim())
    : ['https://usenuroo.com']

  const corsOrigins = isProduction ? productionOrigins : defaultOrigins

  await fastify.register(cors, {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    preflight: true,
    strictPreflight: false,
  })

  await fastify.register(compress, {
    global: true,
    encodings: ['gzip', 'deflate', 'br'],
  })

  await fastify.register(rateLimit, {
    global: false,
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: () => ({ error: 'Too many requests, please slow down.' }),
  })

  fastify.addHook('preHandler', async (request, reply) => {
    const { url, method } = request

    if (url === '/health' || method === 'OPTIONS') return
    if (url.startsWith('/bootstrap/')) return
    if (url.startsWith('/public/')) return
    if (url.startsWith('/api/parent/content/')) return
    if (url.startsWith('/api/parent/alphakids/')) return
    if (url.startsWith('/api/parent/access/')) return

    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    try {
      const token = authHeader.substring(7)
      const decoded = await verifyIdTokenCached(token)
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
    invitesAcceptRoute,
    devRoute,
    parentsRoute,
    assignmentsRoute,
    bootstrapRoute,
    teamRoute,
    groupsRoute,
    contentRoute,
    orgContentRoute,
    orgsRoute,
    reportsRoute,
    parentTasksRoute,
    paymentsRoutes,
    parentApiRoutes,
    aiAssistantRoutes,
    intentRoutes,
    branchesRoute,
    financeRoute,
    brandingRoute,
    parentAiRoute,
    specialistAiRoute,
    pushTokensRoute,
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
    console.log(`\n✅ Backend (Fastify) running at http://${host}:${port}`)
    console.log(`   Health: http://${host}:${port}/health\n`)
  } catch (err) {
    console.error('\n❌ Backend failed to start:', err)
    process.exit(1)
  }
}

void start()
