// Sentry должен быть первым — до всех остальных импортов
import './instrument.js'
import * as Sentry from '@sentry/node'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import rateLimit from '@fastify/rate-limit'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { config } from './config/index.js'
import { initializeFirebaseAdmin, getAuth } from './infrastructure/database/firebase.js'
import type { AuthenticatedUser } from './shared/types/domain.js'

// Domain imports — structured by bounded context
import { systemDomain } from './domains/system/index.js'
import { usersDomain } from './domains/users/index.js'
import { organizationsDomain } from './domains/organizations/index.js'
import { invitationsDomain } from './domains/invitations/index.js'
import { messagingDomain } from './domains/messaging/index.js'
import { tasksDomain } from './domains/tasks/index.js'
import { financeDomain } from './domains/finance/index.js'
import { aiDomain } from './domains/ai/index.js'
import { childrenDomain } from './domains/children/index.js'
import { groupsDomain } from './domains/groups/index.js'
import { contentDomain } from './domains/content/index.js'
import { activityDomain } from './domains/activity/index.js'
import { paymentsDomain } from './domains/payments/index.js'
import { coursesDomain } from './domains/courses/index.js'
import { verificationsDomain } from './domains/verifications/index.js'
import { parentApiRoutes } from './modules/parent-api/index.js'
import { bookingDomain } from './domains/booking/index.js'
import { cohortsDomain } from './domains/cohorts/index.js'
import { favoritesDomain } from './domains/favorites/index.js'
import { auditRoutes } from './infrastructure/audit/audit.routes.js'
import { calendarRoutes } from './domains/calendar/calendar.routes.js'
import { legalRoutes } from './domains/legal/legal.routes.js'

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

  // Sentry перехватывает все необработанные ошибки в роутах
  Sentry.setupFastifyErrorHandler(fastify)

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

  const isAllowedDevOrigin = (origin: string) => {
    if (defaultOrigins.includes(origin)) return true

    try {
      const { hostname } = new URL(origin)
      return hostname === 'localhost' || hostname === '127.0.0.1'
    } catch {
      return false
    }
  }

  await fastify.register(cors, {
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true)
        return
      }

      const allowed = isProduction ? productionOrigins.includes(origin) : isAllowedDevOrigin(origin)
      callback(null, allowed)
    },
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
    if (url.startsWith('/calendar/callback')) return // Google OAuth redirect — no Bearer token
    if (url.startsWith('/api/organizations/public')) return
    if (url.startsWith('/api/parent/content/')) return
    if (url.startsWith('/api/parent/alphakids/')) return
    if (url.startsWith('/api/parent/access/')) return
    if (url.startsWith('/webhooks/')) return
    if (url === '/marketplace/courses' || url.startsWith('/marketplace/courses?')) return
    if (url === '/marketplace/cohorts' || url.startsWith('/marketplace/cohorts?')) return
    // Public marketplace routes — specialists, services, slots (read-only, no auth)
    if (
      method === 'GET' &&
      /^\/marketplace\/organizations\/[^/]+(\/specialists(\/[^/]+\/(services|slots)(\?.*)?)?)?(\?.*)?$/.test(
        url
      )
    )
      return
    // Public read routes — explicit list to avoid accidentally exposing future endpoints
    if (
      method === 'GET' &&
      /^\/marketplace\/orgs\/[^/]+\/courses\/[^/]+(\/modules\/[^/]+\/lessons)?(\?.*)?$/.test(url)
    )
      return
    if (
      method === 'GET' &&
      /^\/marketplace\/orgs\/[^/]+\/courses\/[^/]+\/lessons\/[^/]+(\?.*)?$/.test(url)
    )
      return

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
      // Привязываем пользователя к Sentry — видим кто получил ошибку
      Sentry.setUser({ id: decoded.uid, email: decoded.email })
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })

  const routes = [
    // System utilities
    systemDomain,
    // Domain plugins
    usersDomain,
    organizationsDomain,
    invitationsDomain,
    messagingDomain,
    tasksDomain,
    financeDomain,
    aiDomain,
    childrenDomain,
    groupsDomain,
    contentDomain,
    activityDomain,
    paymentsDomain,
    coursesDomain,
    verificationsDomain,
    bookingDomain,
    cohortsDomain,
    favoritesDomain,
    auditRoutes,
    calendarRoutes,
    legalRoutes,
    // External modules
    parentApiRoutes,
  ]

  for (const route of routes) {
    await fastify.register(route)
  }

  return fastify
}

async function warmUpFirebaseAuth() {
  // Fetch Firebase public keys on startup so the first real auth request isn't slow.
  // verifyIdToken with a dummy token fails signature check but caches the public keys.
  try {
    await getAuth()
      .verifyIdToken('warmup')
      .catch(() => {})
    console.log('[AUTH] Firebase public key cache warmed up')
  } catch {
    // ignore — warmup is best-effort
  }
}

async function start() {
  try {
    const server = await buildServer()
    const port = parseInt(process.env.PORT || config.PORT || '8080', 10)
    // 0.0.0.0 required for Cloud Run container networking (also allows LAN dev on physical devices)
    const host = '0.0.0.0'

    await server.listen({ port, host })
    console.log(`\n✅ Backend (Fastify) running at http://${host}:${port}`)
    console.log(`   Health: http://${host}:${port}/health\n`)

    // Warm up Firebase Auth public key cache in background (don't block startup)
    warmUpFirebaseAuth()
  } catch (err) {
    console.error('\n❌ Backend failed to start:', err)
    process.exit(1)
  }
}

void start()
