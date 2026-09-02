import type { FastifyPluginAsync } from 'fastify'
import { eventsRoute } from './events.routes.js'
import { eventsMarketplaceRoute } from './events.marketplace.routes.js'

export const eventsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(eventsRoute)
  await fastify.register(eventsMarketplaceRoute)
}
