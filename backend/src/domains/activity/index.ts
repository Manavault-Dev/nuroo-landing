import type { FastifyPluginAsync } from 'fastify'
import { activityRoute } from './activity.routes.js'

export const activityDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(activityRoute)
}
