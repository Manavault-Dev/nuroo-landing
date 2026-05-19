import type { FastifyPluginAsync } from 'fastify'

import { groupCrudRoute } from './groupCrud.routes.js'
import { groupParentsRoute } from './groupParents.routes.js'
import { groupAssignmentsRoute } from './groupAssignments.routes.js'

export const groupsRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(groupCrudRoute)
  await fastify.register(groupParentsRoute)
  await fastify.register(groupAssignmentsRoute)
}
