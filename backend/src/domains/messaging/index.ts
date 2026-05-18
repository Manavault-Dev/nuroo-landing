import type { FastifyPluginAsync } from 'fastify'
import { messagesRoute, notesRoute } from './messaging.routes.js'

export const messagingDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(messagesRoute)
  await fastify.register(notesRoute)
}
