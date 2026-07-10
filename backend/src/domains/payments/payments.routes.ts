import { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOrgMember } from '../../infrastructure/auth/rbac.js'
import { createPayment, verifyPayment, getPlanPrices, getPlanNames } from './payments.service.js'
import { PLAN_LIMITS, type PlanId } from './planLimits.js'
import { createPaymentSchema } from './payments.schema.js'

export const paymentsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/plans', async (request, reply) => {
    try {
      const prices = getPlanPrices()
      const names = getPlanNames()

      const plans = (Object.keys(prices) as PlanId[]).map((planId) => {
        const limits = PLAN_LIMITS[planId]
        return {
          id: planId,
          name: names[planId],
          price: prices[planId],
          currency: 'KGS',
          limits: limits ? { children: limits.children, specialists: limits.specialists } : null,
        }
      })

      return {
        ok: true,
        plans,
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to get plans'
      return reply.code(500).send({ ok: false, error: message })
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
      } catch (error: unknown) {
        console.error('Error creating payment:', error)
        return reply
          .code(500)
          .send({ error: error instanceof Error ? error.message : 'Failed to create payment' })
      }
    }
  )

  fastify.get<{ Params: { paymentId: string } }>(
    '/payments/:paymentId/verify',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }

      const { paymentId } = request.params

      try {
        const result = await verifyPayment(paymentId)
        if (!result.ok) {
          return reply.code(404).send({ error: result.error })
        }

        if (!result.orgId) {
          return reply.code(403).send({ error: 'Payment record is missing organization context' })
        }
        await requireOrgMember(request, reply, result.orgId)
        if (reply.sent) return

        return result
      } catch (error: unknown) {
        fastify.log.error(error, 'Error verifying payment')
        return reply.code(500).send({ error: 'Failed to verify payment' })
      }
    }
  )
}
