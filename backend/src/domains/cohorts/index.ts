import type { FastifyPluginAsync } from 'fastify'
import { cohortsRoute } from './cohorts.routes.js'
import { cohortsSessionsRoute } from './cohorts.sessions.routes.js'
import { cohortsParticipantsRoute } from './cohorts.participants.routes.js'
import { cohortsAttendanceRoute } from './cohorts.attendance.routes.js'
import { cohortsMarketplaceRoute } from './cohorts.marketplace.routes.js'
import { cohortsWaitlistRoute } from './cohorts.waitlist.routes.js'

export const cohortsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cohortsRoute)
  await fastify.register(cohortsSessionsRoute)
  await fastify.register(cohortsParticipantsRoute)
  await fastify.register(cohortsAttendanceRoute)
  await fastify.register(cohortsMarketplaceRoute)
  await fastify.register(cohortsWaitlistRoute)
}
