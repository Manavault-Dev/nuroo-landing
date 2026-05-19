import type { FastifyPluginAsync } from 'fastify'
import { meRoute, parentsRoute, sessionRoute } from './users.routes.js'

export const usersDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meRoute)
  await fastify.register(parentsRoute)
  await fastify.register(sessionRoute)
}
