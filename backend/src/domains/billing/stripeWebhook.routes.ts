import type { FastifyPluginAsync } from 'fastify'
import type Stripe from 'stripe'
import * as Sentry from '@sentry/node'
import admin from 'firebase-admin'

import { getFirestore } from '../../infrastructure/database/firebase.js'
import { constructWebhookEvent } from './stripe.service.js'
import type { PlanId } from '../../modules/payments/planLimits.js'

type StripeBillingStatus = 'trialing' | 'active' | 'past_due' | 'canceled'

interface OrgBillingUpdate {
  provider: 'stripe'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  plan?: PlanId
  status: StripeBillingStatus
  trialEndsAt?: admin.firestore.Timestamp | null
  currentPeriodEnd?: admin.firestore.Timestamp | null
  updatedAt: admin.firestore.Timestamp
}

function toTimestamp(unixSeconds: number | null | undefined): admin.firestore.Timestamp | null {
  if (!unixSeconds) return null
  return admin.firestore.Timestamp.fromMillis(unixSeconds * 1000)
}

function mapStripeStatus(stripeStatus: string): StripeBillingStatus {
  switch (stripeStatus) {
    case 'trialing':
      return 'trialing'
    case 'active':
      return 'active'
    case 'past_due':
      return 'past_due'
    case 'canceled':
    case 'cancelled':
    case 'incomplete_expired':
    case 'unpaid':
      return 'canceled'
    default:
      return 'active'
  }
}

async function isEventAlreadyProcessed(
  eventId: string,
  db: FirebaseFirestore.Firestore
): Promise<boolean> {
  const snap = await db.collection('stripeWebhookEvents').doc(eventId).get()
  return snap.exists
}

async function markEventProcessed(
  eventId: string,
  eventType: string,
  db: FirebaseFirestore.Firestore
): Promise<void> {
  await db.collection('stripeWebhookEvents').doc(eventId).set({
    eventType,
    processedAt: admin.firestore.Timestamp.now(),
  })
}

async function updateOrgBilling(
  orgId: string,
  update: OrgBillingUpdate,
  db: FirebaseFirestore.Firestore
): Promise<void> {
  await db.collection('organizations').doc(orgId).set({ billing: update }, { merge: true })
}

export const stripeWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(async (child) => {
    child.addContentTypeParser(
      'application/json',
      { parseAs: 'buffer', bodyLimit: 1_048_576 },
      function (_req, body, done) {
        done(null, body)
      }
    )

    child.post('/webhooks/stripe', async (request, reply) => {
      const sig = request.headers['stripe-signature']

      if (!sig || typeof sig !== 'string') {
        fastify.log.warn({ event: 'stripe_webhook_missing_signature' })
        return reply.code(400).send({ error: 'Missing stripe-signature header' })
      }

      let event: Stripe.Event
      try {
        event = constructWebhookEvent(request.body as Buffer, sig)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        fastify.log.warn({ event: 'stripe_webhook_invalid_signature', message })
        Sentry.captureMessage('stripe_webhook_invalid_signature', {
          level: 'warning',
          extra: { message },
        })
        return reply.code(400).send({ error: 'Webhook signature verification failed' })
      }

      fastify.log.info({ event: 'stripe_webhook_received', eventType: event.type })

      const db = getFirestore()

      const alreadyProcessed = await isEventAlreadyProcessed(event.id, db)
      if (alreadyProcessed) {
        return reply.code(200).send({ received: true })
      }

      try {
        switch (event.type) {
          case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session
            const orgId = session.metadata?.orgId
            const planId = session.metadata?.planId as PlanId | undefined

            if (!orgId || !planId) break

            const customerId =
              typeof session.customer === 'string' ? session.customer : session.customer?.id
            const subscriptionId =
              typeof session.subscription === 'string'
                ? session.subscription
                : session.subscription?.id

            const billingUpdate: OrgBillingUpdate = {
              provider: 'stripe',
              stripeCustomerId: customerId ?? undefined,
              stripeSubscriptionId: subscriptionId ?? undefined,
              plan: planId,
              status: 'trialing',
              updatedAt: admin.firestore.Timestamp.now(),
            }

            await updateOrgBilling(orgId, billingUpdate, db)
            break
          }

          case 'customer.subscription.updated': {
            const subscription = event.data.object as Stripe.Subscription
            const orgId = subscription.metadata?.orgId

            if (!orgId) break

            const status = mapStripeStatus(subscription.status)
            const billingUpdate: OrgBillingUpdate = {
              provider: 'stripe',
              stripeSubscriptionId: subscription.id,
              status,
              trialEndsAt: toTimestamp(subscription.trial_end),
              currentPeriodEnd: toTimestamp(subscription.current_period_end),
              updatedAt: admin.firestore.Timestamp.now(),
            }

            await updateOrgBilling(orgId, billingUpdate, db)
            break
          }

          case 'customer.subscription.deleted': {
            const subscription = event.data.object as Stripe.Subscription
            const orgId = subscription.metadata?.orgId

            if (!orgId) break

            const billingUpdate: OrgBillingUpdate = {
              provider: 'stripe',
              stripeSubscriptionId: subscription.id,
              status: 'canceled',
              currentPeriodEnd: toTimestamp(subscription.current_period_end),
              updatedAt: admin.firestore.Timestamp.now(),
            }

            await updateOrgBilling(orgId, billingUpdate, db)
            break
          }

          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice
            const customerId =
              typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

            if (!customerId) break

            const orgQuery = await db
              .collection('organizations')
              .where('billing.stripeCustomerId', '==', customerId)
              .limit(1)
              .get()

            if (orgQuery.empty) break

            const orgDoc = orgQuery.docs[0]
            const orgId = orgDoc.id

            const billingUpdate: OrgBillingUpdate = {
              provider: 'stripe',
              status: 'past_due',
              updatedAt: admin.firestore.Timestamp.now(),
            }

            await updateOrgBilling(orgId, billingUpdate, db)

            child.log.warn({ event: 'stripe_webhook_payment_failed', orgId })
            Sentry.captureMessage('stripe_webhook_payment_failed', {
              level: 'warning',
              extra: { orgId },
            })
            break
          }

          case 'invoice.payment_succeeded': {
            const invoice = event.data.object as Stripe.Invoice
            const customerId =
              typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id

            if (!customerId) break

            const orgQuery = await db
              .collection('organizations')
              .where('billing.stripeCustomerId', '==', customerId)
              .limit(1)
              .get()

            if (orgQuery.empty) break

            const orgDoc = orgQuery.docs[0]
            const orgId = orgDoc.id
            const currentStatus = orgDoc.data()?.billing?.status

            if (currentStatus === 'past_due') {
              const billingUpdate: OrgBillingUpdate = {
                provider: 'stripe',
                status: 'active',
                updatedAt: admin.firestore.Timestamp.now(),
              }
              await updateOrgBilling(orgId, billingUpdate, db)
            }
            break
          }

          default:
            break
        }

        await markEventProcessed(event.id, event.type, db)
      } catch (err) {
        Sentry.captureException(err, { extra: { eventType: event.type, eventId: event.id } })
        child.log.error({ event: 'stripe_webhook_processing_error', eventType: event.type })
      }

      return reply.code(200).send({ received: true })
    })
  })
}
