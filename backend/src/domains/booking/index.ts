import type { FastifyPluginAsync } from 'fastify'
import { servicesRoute } from './services.routes.js'
import { availabilityRoute } from './availability.routes.js'
import { slotsRoute } from './slots.routes.js'
import { bookingRoute } from './booking.routes.js'
import { intakeRoute } from './intake.routes.js'
import { blockingRoute } from './blocking.routes.js'

export const bookingDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(servicesRoute)
  await fastify.register(availabilityRoute)
  await fastify.register(slotsRoute)
  await fastify.register(bookingRoute)
  await fastify.register(intakeRoute)
  await fastify.register(blockingRoute)
}
