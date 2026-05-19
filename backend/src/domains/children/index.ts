import type { FastifyPluginAsync } from 'fastify'
import { childrenRoute } from './children.routes.js'

export const childrenDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(childrenRoute)
}
