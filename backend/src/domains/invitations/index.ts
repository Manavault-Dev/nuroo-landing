import type { FastifyPluginAsync } from 'fastify'
import { invitesRoute, invitesAcceptRoute, joinRoute } from './invitations.routes.js'

export const invitationsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(invitesRoute)
  await fastify.register(invitesAcceptRoute)
  await fastify.register(joinRoute)
}
