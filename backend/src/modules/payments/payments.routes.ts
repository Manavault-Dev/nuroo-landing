import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrgMember } from '../../shared/guards/index.js'
import { createPayment, handleWebhook, verifyPayment, getPlanPrices, getPlanNames } from './payments.service.js'
import { createPaymentSchema, webhookSchema } from './payments.schema.js'

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/plans', async (request, reply) => {
    try {
      const prices = getPlanPrices()
      const names = getPlanNames()

      const plans = Object.keys(prices).map((planId) => ({
        id: planId,
        name: names[planId],
        price: prices[planId],
        currency: 'KGS',
      }))

      console.log('[PAYMENTS] Returning plans:', plans)

      return {
        ok: true,
        plans,
      }
    } catch (error: any) {
      console.error('[PAYMENTS] Error getting plans:', error)
      return reply.code(500).send({ ok: false, error: error.message || 'Failed to get plans' })
    }
  })

  fastify.post<{ Params: { orgId: string }; Body: z.infer<typeof createPaymentSchema> }>(
    '/orgs/:orgId/payments',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { orgId } = request.params
      const { uid } = request.user

      const member = await requireOrgMember(request, reply, orgId)

      if (member.role !== 'org_admin') {
        return reply.code(403).send({ error: 'Only organization admins can create payments' })
      }

      const body = createPaymentSchema.parse(request.body)

      if (body.orgId !== orgId) {
        return reply.code(400).send({ error: 'Organization ID mismatch' })
      }

      try {
        const result = await createPayment(body, uid)
        return result
      } catch (error: any) {
        console.error('Error creating payment:', error)
        return reply.code(500).send({ error: error.message || 'Failed to create payment' })
      }
    }
  )

  fastify.get<{ Params: { paymentId: string } }>('/payments/:paymentId/verify', async (request, reply) => {
    if (!request.user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const { paymentId } = request.params

    try {
      const result = await verifyPayment(paymentId)
      if (!result.ok) {
        return reply.code(404).send({ error: result.error })
      }
      return result
    } catch (error: any) {
      console.error('Error verifying payment:', error)
      return reply.code(500).send({ error: error.message || 'Failed to verify payment' })
    }
  })

  fastify.post<{ Body: z.infer<typeof webhookSchema> }>('/webhooks/finik', async (request, reply) => {
    try {
      const body = webhookSchema.parse(request.body)
      const result = await handleWebhook(body)

      if (!result.ok) {
        return reply.code(400).send({ error: result.error })
      }

      return { ok: true }
    } catch (error: any) {
      console.error('Error handling webhook:', error)
      return reply.code(400).send({ error: error.message || 'Invalid webhook data' })
    }
  })
}
