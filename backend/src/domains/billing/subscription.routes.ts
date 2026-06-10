import type { FastifyPluginAsync } from 'fastify'
import * as Sentry from '@sentry/node'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { requireOrgMember, requireOrgAdmin } from '../../shared/guards/index.js'
import { PLAN_IDS, type PlanId, getSubscriptionStatus } from '../../modules/payments/planLimits.js'
import { config } from '../../config/index.js'
import {
  createCheckoutSession,
  createCustomer,
  createCustomerPortalSession,
} from './stripe.service.js'

const TRIAL_DAYS = 30

function timestampToIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }
  return null
}

function isBillingActive(
  status: unknown,
  trialEndsAt: string | null,
  currentPeriodEnd: string | null
): boolean {
  if (status === 'manual_active' || status === 'active') {
    if (!currentPeriodEnd) return true
    return new Date(currentPeriodEnd).getTime() > Date.now()
  }
  if (status === 'trialing') {
    if (!trialEndsAt) return false
    return new Date(trialEndsAt).getTime() > Date.now()
  }
  return false
}

export const subscriptionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/start-trial',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgAdmin(request, reply, orgId)

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const existingStatus = orgSnap.data()?.billing?.status
      if (existingStatus === 'trialing') {
        const trialEndsAt = timestampToIso(orgSnap.data()?.billing?.trialEndsAt)
        return reply.code(200).send({ ok: true, alreadyTrialing: true, trialEndsAt })
      }
      if (existingStatus === 'active' || existingStatus === 'manual_active') {
        return reply
          .code(409)
          .send({ error: 'Subscription is already active', code: 'ALREADY_ACTIVE' })
      }

      const now = admin.firestore.Timestamp.now()
      const trialEndsAt = admin.firestore.Timestamp.fromMillis(
        Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
      )

      await db
        .collection('organizations')
        .doc(orgId)
        .set(
          {
            billing: {
              status: 'trialing',
              provider: 'nuroo',
              plan: 'growth',
              trialEndsAt,
              updatedAt: now,
            },
          },
          { merge: true }
        )

      fastify.log.info({ event: 'trial_started', orgId })
      Sentry.addBreadcrumb({
        category: 'billing',
        message: 'trial_started',
        level: 'info',
        data: { orgId },
      })

      return reply.code(200).send({ ok: true, trialEndsAt: timestampToIso(trialEndsAt) })
    }
  )

  fastify.post<{
    Params: { orgId: string }
    Body: { planId: PlanId; successUrl: string; cancelUrl: string }
  }>(
    '/orgs/:orgId/billing/checkout',
    {
      schema: {
        body: {
          type: 'object',
          required: ['planId', 'successUrl', 'cancelUrl'],
          properties: {
            planId: { type: 'string', enum: [...PLAN_IDS] },
            successUrl: { type: 'string', format: 'uri' },
            cancelUrl: { type: 'string', format: 'uri' },
          },
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params
      const { planId, successUrl, cancelUrl } = request.body

      await requireOrgAdmin(request, reply, orgId)

      if (config.BILLING_MODE === 'manual') {
        return reply.code(403).send({
          error:
            'Stripe checkout is not available. Contact the Nuroo team to activate your subscription.',
          code: 'BILLING_MODE_MANUAL',
        })
      }

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const orgData = orgSnap.data() ?? {}
      let stripeCustomerId: string = orgData.billing?.stripeCustomerId ?? ''
      if (!stripeCustomerId) {
        const customer = await createCustomer(request.user!.email ?? '', orgId)
        stripeCustomerId = customer.id
      }

      const session = await createCheckoutSession(
        orgId,
        planId,
        request.user!.email ?? '',
        successUrl,
        cancelUrl,
        stripeCustomerId
      )

      fastify.log.info({ event: 'stripe_checkout_created', orgId, planId })
      Sentry.addBreadcrumb({
        category: 'stripe',
        message: 'stripe_checkout_created',
        level: 'info',
        data: { orgId, planId },
      })

      return reply.code(200).send({ ok: true, url: session.url })
    }
  )

  fastify.get<{ Params: { orgId: string } }>(
    '/orgs/:orgId/billing/status',
    async (request, reply) => {
      const { orgId } = request.params
      await requireOrgMember(request, reply, orgId)

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const billingField = orgSnap.data()?.billing ?? {}
      const subscriptionStatus = await getSubscriptionStatus(orgId)
      const trialEndsAt = timestampToIso(billingField.trialEndsAt)
      const currentPeriodEnd = timestampToIso(billingField.currentPeriodEnd)
      const updatedAt = timestampToIso(billingField.updatedAt)
      const billingActive = isBillingActive(billingField.status, trialEndsAt, currentPeriodEnd)
      const billingPlan = typeof billingField.plan === 'string' ? billingField.plan : null

      return reply.code(200).send({
        ok: true,
        active: subscriptionStatus.active || billingActive,
        planId: subscriptionStatus.planId ?? (billingActive ? billingPlan : undefined),
        source:
          subscriptionStatus.source ??
          (billingActive
            ? billingField.status === 'trialing'
              ? 'free_trial'
              : 'subscription'
            : undefined),
        billingStatus: billingField.status ?? subscriptionStatus.billingStatus,
        expiresAt: subscriptionStatus.expiresAt
          ? timestampToIso(subscriptionStatus.expiresAt)
          : currentPeriodEnd,
        billing: {
          provider: billingField.provider ?? null,
          status: billingField.status ?? null,
          plan: billingPlan,
          trialEndsAt,
          currentPeriodEnd,
          updatedAt,
          subscriptionActive: subscriptionStatus.active || billingActive,
          subscriptionSource: subscriptionStatus.source ?? null,
          subscriptionError: subscriptionStatus.error ?? null,
          stripeCustomerId: billingField.stripeCustomerId ?? null,
          stripeSubscriptionId: billingField.stripeSubscriptionId ?? null,
        },
        billingMode: config.BILLING_MODE,
      })
    }
  )

  fastify.post<{
    Params: { orgId: string }
    Body: { returnUrl: string }
  }>(
    '/orgs/:orgId/billing/portal',
    {
      schema: {
        body: {
          type: 'object',
          required: ['returnUrl'],
          properties: { returnUrl: { type: 'string', format: 'uri' } },
        },
      },
    },
    async (request, reply) => {
      const { orgId } = request.params
      const { returnUrl } = request.body
      await requireOrgAdmin(request, reply, orgId)

      if (config.BILLING_MODE === 'manual') {
        return reply.code(403).send({
          error: 'Stripe portal is not available in manual billing mode.',
          code: 'BILLING_MODE_MANUAL',
        })
      }

      const db = getFirestore()
      const orgSnap = await db.collection('organizations').doc(orgId).get()
      if (!orgSnap.exists) {
        return reply.code(404).send({ error: 'Organization not found', code: 'ORG_NOT_FOUND' })
      }

      const stripeCustomerId: string | undefined = orgSnap.data()?.billing?.stripeCustomerId
      if (!stripeCustomerId) {
        return reply.code(400).send({
          error: 'No Stripe customer found for this organization.',
          code: 'NO_STRIPE_CUSTOMER',
        })
      }

      const portalSession = await createCustomerPortalSession(stripeCustomerId, returnUrl)
      return reply.code(200).send({ ok: true, url: portalSession.url })
    }
  )
}
