import Fastify from 'fastify'
import cors from '@fastify/cors'
import { config } from './config/index.js'
import { getCorsConfig } from './config/cors.js'
import { initializeFirebaseAdmin } from './infrastructure/database/firebase.js'
import { authPreHandler } from './infrastructure/auth/authPlugin.js'
import { errorHandler } from './infrastructure/middleware/errorHandler.js'

// Import all module routes
import { healthRoutes } from './modules/health/index.js'
import { usersRoutes } from './modules/users/index.js'
import { childrenRoutes } from './modules/children/index.js'
import { notesRoutes } from './modules/notes/index.js'
import { invitesRoutes } from './modules/invites/index.js'
import { parentsRoutes } from './modules/parents/index.js'
import { assignmentsRoutes } from './modules/assignments/index.js'
import { adminRoutes } from './modules/admin/index.js'
import { parentApiRoutes } from './modules/parent-api/index.js'
import { paymentsRoutes } from './modules/payments/index.js'

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: config.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  })

  // Initialize Firebase Admin
  initializeFirebaseAdmin()

  // Register CORS
  await fastify.register(cors, getCorsConfig(config))

  // Register auth pre-handler
  fastify.addHook('preHandler', authPreHandler)

  // Register error handler
  fastify.setErrorHandler(errorHandler)

  // Register all routes
  await fastify.register(healthRoutes)
  await fastify.register(usersRoutes)
  await fastify.register(childrenRoutes)
  await fastify.register(notesRoutes)
  await fastify.register(invitesRoutes)
  await fastify.register(parentsRoutes)
  await fastify.register(assignmentsRoutes)
  await fastify.register(adminRoutes)
  await fastify.register(parentApiRoutes)
  await fastify.register(paymentsRoutes)

  return fastify
}
