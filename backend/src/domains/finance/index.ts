import type { FastifyPluginAsync } from 'fastify'
import { financeRoute, reportsRoute } from './finance.routes.js'

export const financeDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(financeRoute)
  await fastify.register(reportsRoute)
}
