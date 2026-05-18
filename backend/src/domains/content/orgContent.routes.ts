import type { FastifyPluginAsync } from 'fastify'

import { orgContentAdminRoute } from './orgContentAdmin.routes.js'
import { orgParentContentRoute } from './orgParentContent.routes.js'

export const orgContentRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(orgContentAdminRoute)
  await fastify.register(orgParentContentRoute)
}
