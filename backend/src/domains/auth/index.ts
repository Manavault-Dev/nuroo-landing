import type { FastifyPluginAsync } from 'fastify'
import { passwordResetRoutes } from './password-reset.routes.js'

export const authDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(passwordResetRoutes)
}
