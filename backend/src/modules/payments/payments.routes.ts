import { FastifyPluginAsync } from 'fastify'
import { createHmac, timingSafeEqual } from 'crypto'
import { z } from 'zod'
import { requireOrgMember } from '../../shared/guards/index.js'
import {
  createPayment,
  handleWebhook,
  verifyPayment,
  getPlanPrices,
  getPlanNames,
} from './payments.service.js'
import {
  PLAN_LIMITS,
  PLAN_CONFIG,
  getPlanLimits,
  getSubscriptionStatus,
  getFreeTrialStatus,
  getBillingBadgeKey,
  normalizePlanId,
  type PlanId,
} from './planLimits.js'
import { createPaymentSchema, webhookSchema } from './payments.schema.js'
import { getBillingPlan } from './payments.repository.js'

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

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/status',
    async (request, reply) => {
      if (!request.user) {
        return reply.code(401).send({ error: 'Unauthorized' })
      }
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)
      const status = await getSubscriptionStatus(orgId)
      const billing = await getBillingPlan(orgId)
      const trial = await getFreeTrialStatus(orgId)
      const limits = status.planId ? getPlanLimits(status.planId) : null
      const normalizedPlanId = normalizePlanId(status.planId ?? 'starter') ?? 'starter'
      const planConfig = PLAN_CONFIG[normalizedPlanId]
      const badge = getBillingBadgeKey(status.billingStatus)

      // Count current usage
      const db = (await import('../../infrastructure/database/firebase.js')).getFirestore()
      const [childrenSnap, membersSnap] = await Promise.all([
        db.collection('organizations').doc(orgId).collection('children').count().get(),
        db.collection('organizations').doc(orgId).collection('members').count().get(),
      ])

      return {
        ok: true,
        active: status.active,
        planId: status.planId ?? null,
        source: status.source ?? null,
        billingStatus: status.billingStatus ?? null,
        badge,
        error: status.error ?? null,
        expiresAt:
          status.expiresAt?.toDate?.()?.toISOString() ??
          billing?.expiresAt?.toDate?.()?.toISOString() ??
          null,
        limits: limits ? { children: limits.children, specialists: limits.specialists } : null,
        usage: {
          children: childrenSnap.data().count,
          specialists: membersSnap.data().count,
          childrenLimit: planConfig?.maxChildren ?? null,
          specialistsLimit: planConfig?.maxSpecialists ?? null,
        },
        features: planConfig?.features ?? null,
        trial: trial
          ? {
              active: trial.active,
              planId: trial.planId,
              startedAt: trial.startedAt?.toDate?.()?.toISOString() ?? null,
              expiresAt: trial.expiresAt?.toDate?.()?.toISOString() ?? null,
            }
          : null,
      }
    }
  )

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

        if (result.payment && (result as any).orgId) {
          await requireOrgMember(request, reply, (result as any).orgId)
          if (reply.sent) return
        }
        return result
      } catch (error: unknown) {
        fastify.log.error(error, 'Error verifying payment')
        return reply.code(500).send({ error: 'Failed to verify payment' })
      }
    }
  )

  fastify.post<{ Body: z.infer<typeof webhookSchema> }>(
    '/webhooks/finik',
    async (request, reply) => {
      try {
        const secret = process.env.FINIK_WEBHOOK_SECRET
        if (secret) {
          const sig = request.headers['x-finik-signature'] as string | undefined
          const expected = createHmac('sha256', secret)
            .update(JSON.stringify(request.body))
            .digest('hex')
          const sigBuf = Buffer.from(sig ?? '', 'utf8')
          const expectedBuf = Buffer.from(expected, 'utf8')
          const signatureInvalid =
            sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)
          if (signatureInvalid) {
            return reply.code(401).send({ error: 'Invalid webhook signature' })
          }
        }

        const body = webhookSchema.parse(request.body)
        const result = await handleWebhook(body)

        if (!result.ok) {
          return reply.code(400).send({ error: result.error })
        }

        return { ok: true }
      } catch (error: unknown) {
        console.error('Error handling webhook:', error)
        return reply
          .code(400)
          .send({ error: error instanceof Error ? error.message : 'Invalid webhook data' })
      }
    }
  )
}
