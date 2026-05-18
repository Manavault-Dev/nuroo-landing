import type { FastifyPluginAsync } from 'fastify'
import { healthRoute, bootstrapRoute, devRoute, pushTokensRoute } from './system.routes.js'

export const systemDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoute)
  await fastify.register(bootstrapRoute)
  await fastify.register(devRoute)
  await fastify.register(pushTokensRoute)
}
