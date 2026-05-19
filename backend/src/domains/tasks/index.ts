import type { FastifyPluginAsync } from 'fastify'
import { assignmentsRoute, parentTasksRoute } from './tasks.routes.js'

export const tasksDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(assignmentsRoute)
  await fastify.register(parentTasksRoute)
}
