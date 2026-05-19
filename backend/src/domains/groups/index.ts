import type { FastifyPluginAsync } from 'fastify'
import { groupsRoute } from './groups.routes.js'

export const groupsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(groupsRoute)
}
