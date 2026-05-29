import type { FastifyPluginAsync } from 'fastify'
import { invoiceRoutes } from './invoice.routes.js'
import { providerConfigRoutes } from './providerConfig.routes.js'
import { webhookRoutes } from './webhook.routes.js'
import { billingProfileRoutes } from './billingProfile.routes.js'

export const paymentsDomain: FastifyPluginAsync = async (fastify) => {
  await fastify.register(invoiceRoutes)
  await fastify.register(providerConfigRoutes)
  await fastify.register(webhookRoutes)
  await fastify.register(billingProfileRoutes)
}
