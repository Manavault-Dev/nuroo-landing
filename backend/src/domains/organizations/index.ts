import type { FastifyPluginAsync } from 'fastify'
import { orgsRoute, branchesRoute, teamRoute, brandingRoute } from './organizations.routes.js'

export const organizationsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(orgsRoute)
  await fastify.register(branchesRoute)
  await fastify.register(teamRoute)
  await fastify.register(brandingRoute)
}
