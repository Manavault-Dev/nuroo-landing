import type { FastifyPluginAsync } from 'fastify'
import { subscriptionRoutes } from './subscription.routes.js'
import { stripeWebhookRoutes } from './stripeWebhook.routes.js'
import { manualBillingRoutes } from './manualBilling.routes.js'

export const billingDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(subscriptionRoutes)
  await fastify.register(stripeWebhookRoutes)
  await fastify.register(manualBillingRoutes)
}

export { billingDomain as default }
