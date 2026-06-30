import type { FastifyPluginAsync } from 'fastify'
import { parentAiRoute, specialistAiRoute } from './ai.routes.js'
import { aiReportRoute } from './aiReport.routes.js'

export const aiDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(parentAiRoute)
  await fastify.register(specialistAiRoute)
  await fastify.register(aiReportRoute)
}
