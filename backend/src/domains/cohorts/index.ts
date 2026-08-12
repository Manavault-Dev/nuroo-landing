import type { FastifyPluginAsync } from 'fastify'
import { cohortsRoute } from './cohorts.routes.js'
import { cohortsMarketplaceRoute } from './cohorts.marketplace.routes.js'
import { cohortsWaitlistRoute } from './cohorts.waitlist.routes.js'

export const cohortsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cohortsRoute)
  await fastify.register(cohortsMarketplaceRoute)
  await fastify.register(cohortsWaitlistRoute)
}
