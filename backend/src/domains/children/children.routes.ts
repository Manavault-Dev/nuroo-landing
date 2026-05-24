import type { FastifyPluginAsync } from 'fastify'

import { childrenConnectionsRoute } from './childrenConnections.routes.js'
import { childrenRecordsRoute } from './childrenRecords.routes.js'
import { childrenTimelineRoute } from './childrenTimeline.routes.js'
import { childrenTasksRoute } from './childrenTasks.routes.js'
import { childrenProfilesRoute } from './childrenProfiles.routes.js'
import { childrenGuardiansRoute } from './childrenGuardians.routes.js'
import { childrenIntakeRoute } from './childrenIntake.routes.js'

export const childrenRoute: FastifyPluginAsync = async (fastify) => {
  await fastify.register(childrenConnectionsRoute)
  await fastify.register(childrenRecordsRoute)
  await fastify.register(childrenTimelineRoute)
  await fastify.register(childrenTasksRoute)
  await fastify.register(childrenProfilesRoute)
  await fastify.register(childrenGuardiansRoute)
  await fastify.register(childrenIntakeRoute)
}
