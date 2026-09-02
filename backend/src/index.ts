import './instrument.js'
import * as Sentry from '@sentry/node'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import compress from '@fastify/compress'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import type { DecodedIdToken } from 'firebase-admin/auth'
import { config } from './config/index.js'
import { initializeFirebaseAdmin, getAuth } from './infrastructure/database/firebase.js'
import { cacheGet, cacheSet, cacheDel } from './infrastructure/cache/token-cache.js'
import type { AuthenticatedUser } from './shared/types/domain.js'

// Domain imports — structured by bounded context
import { systemDomain, notificationsDomain } from './domains/system/index.js'
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
import { eventsDomain } from './domains/events/index.js'
import { favoritesDomain } from './domains/favorites/index.js'
import { auditRoutes } from './infrastructure/audit/audit.routes.js'
import { calendarRoutes } from './domains/calendar/calendar.routes.js'
import { legalRoutes } from './domains/legal/legal.routes.js'
import { passwordResetRoutes } from './domains/auth/password-reset.routes.js'

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthenticatedUser
  }
}

async function verifyIdTokenCached(token: string): Promise<DecodedIdToken> {
  const cached = cacheGet(token)
  if (cached) return cached

  cacheDel(token)
  const decoded = await getAuth().verifyIdToken(token)
  const tokenExpMs = decoded.exp ? decoded.exp * 1000 : Date.now() + 5 * 60 * 1000
  cacheSet(token, decoded, tokenExpMs)
  return decoded
}

async function buildServer() {
  const isProduction = config.NODE_ENV === 'production'

  const fastify = Fastify({
    logger: { level: isProduction ? 'warn' : 'info' },
  })

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

  await fastify.register(helmet, {
    // CSP disabled — API server, not HTML. Enable when serving HTML pages.
    contentSecurityPolicy: false,
    // Allow cross-origin requests (CORS is handled separately)
    crossOriginResourcePolicy: { policy: 'cross-origin' },
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

    // Strip optional /v1 prefix for whitelist matching — routes are versioned but
    // public-route checks are path-only (no auth needed regardless of version prefix).
    const urlPath = url.startsWith('/v1/') ? url.slice(3) : url

    if (urlPath.startsWith('/calendar/callback')) return // Google OAuth redirect — no Bearer token
    if (urlPath.startsWith('/api/organizations/public')) return
    if (urlPath.startsWith('/api/parent/content/')) return
    if (urlPath.startsWith('/api/parent/alphakids/')) return
    if (urlPath.startsWith('/api/parent/access/')) return
    if (urlPath.startsWith('/webhooks/')) return
    if (urlPath === '/auth/forgot-password') return
    if (urlPath === '/marketplace/courses' || urlPath.startsWith('/marketplace/courses?')) return
    if (urlPath === '/marketplace/cohorts' || urlPath.startsWith('/marketplace/cohorts?')) return
    if (urlPath === '/marketplace/events' || urlPath.startsWith('/marketplace/events?')) return
    // Public marketplace routes — specialists, services, slots (read-only, no auth)
    if (
      method === 'GET' &&
      /^\/marketplace\/organizations\/[^/]+(\/specialists(\/[^/]+\/(services|slots)(\?.*)?)?)?(\?.*)?$/.test(
        urlPath
      )
    )
      return
    // Public read routes — explicit list to avoid accidentally exposing future endpoints
    if (
      method === 'GET' &&
      /^\/marketplace\/orgs\/[^/]+\/courses\/[^/]+(\/modules\/[^/]+\/lessons)?(\?.*)?$/.test(
        urlPath
      )
    )
      return
    if (
      method === 'GET' &&
      /^\/marketplace\/orgs\/[^/]+\/courses\/[^/]+\/lessons\/[^/]+(\?.*)?$/.test(urlPath)
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
      Sentry.setUser({ id: decoded.uid, email: decoded.email })
    } catch {
      return reply.code(401).send({ error: 'Invalid token' })
    }
  })

  // System routes (health, bootstrap) — no version prefix, needed by infra/load-balancers
  await fastify.register(systemDomain)

  // All domain routes are versioned under /v1
  const v1Routes = [
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
    eventsDomain,
    favoritesDomain,
    auditRoutes,
    calendarRoutes,
    legalRoutes,
    passwordResetRoutes,
    notificationsDomain,
    parentApiRoutes, // external module
  ]

  await fastify.register(
    async (v1) => {
      for (const route of v1Routes) {
        await v1.register(route)
      }
    },
    { prefix: '/v1' }
  )

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
