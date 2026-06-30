import type { FastifyPluginAsync } from 'fastify'
import { healthRoute, bootstrapRoute, devRoute, pushTokensRoute } from './system.routes.js'
import { demoSeedRoute } from './demoSeed.routes.js'

export const systemDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(healthRoute)
  await fastify.register(bootstrapRoute)
  await fastify.register(devRoute)
  await fastify.register(pushTokensRoute)
  await fastify.register(demoSeedRoute)
}
