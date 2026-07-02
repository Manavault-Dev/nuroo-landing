import type { FastifyPluginAsync } from 'fastify'
import { childVerificationsRoute } from './childVerifications.routes.js'

export const verificationsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(childVerificationsRoute)
}

export { verificationsDomain as default }
