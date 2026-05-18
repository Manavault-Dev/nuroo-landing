import type { FastifyPluginAsync } from 'fastify'
import { contentRoute, orgContentRoute } from './content.routes.js'

export const contentDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(contentRoute)
  await fastify.register(orgContentRoute)
}
