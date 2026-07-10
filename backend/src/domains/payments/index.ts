import type { FastifyPluginAsync } from 'fastify'
import { invoiceRoutes } from './invoice.routes.js'
import { providerConfigRoutes } from './providerConfig.routes.js'
import { webhookRoutes } from './webhook.routes.js'
import { billingProfileRoutes } from './billingProfile.routes.js'
import { subscriptionRoutes } from './subscription.routes.js'
import { stripeWebhookRoutes } from './stripeWebhook.routes.js'
import { manualBillingRoutes } from './manualBilling.routes.js'
import { paymentsRoutes } from './payments.routes.js'

export const paymentsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(invoiceRoutes)
  await fastify.register(providerConfigRoutes)
  await fastify.register(webhookRoutes)
  await fastify.register(billingProfileRoutes)
  await fastify.register(subscriptionRoutes)
  await fastify.register(stripeWebhookRoutes)
  await fastify.register(manualBillingRoutes)
  await fastify.register(paymentsRoutes)
}

// Re-export plan utilities used across domains
export * from './planLimits.js'
export * from './payments.service.js'
export * from './payments.repository.js'
export * from './payments.schema.js'
