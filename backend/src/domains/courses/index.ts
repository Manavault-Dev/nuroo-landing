import type { FastifyPluginAsync } from 'fastify'
import { coursesRoute } from './courses.routes.js'
import { marketplaceRoute } from './marketplace.routes.js'

export const coursesDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(coursesRoute)
  await fastify.register(marketplaceRoute)
}

export { coursesDomain as default }
