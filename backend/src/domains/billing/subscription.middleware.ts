import type { Firestore } from 'firebase-admin/firestore'
import admin from 'firebase-admin'

const PAST_DUE_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000

export type BillingStatusValue =
  | 'trialing'
  | 'active'
  | 'manual_active'
  | 'past_due'
  | 'expired'
  | 'canceled'
  | 'cancelled'

export interface SubscriptionAccess {
  allowed: boolean
  reason?: string
  code?:
    | 'TRIAL_EXPIRED'
    | 'MANUAL_ACTIVE_EXPIRED'
    | 'CANCELED'
    | 'NO_SUBSCRIPTION'
    | 'PAST_DUE_GRACE_EXPIRED'
}

type BillingDoc = {
  status?: string
  trialEndsAt?: admin.firestore.Timestamp | null
  currentPeriodEnd?: admin.firestore.Timestamp | null
  updatedAt?: admin.firestore.Timestamp | null
}

export async function requireActiveSubscription(
  orgId: string,
  db: Firestore
): Promise<SubscriptionAccess> {
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) {
    return { allowed: false, reason: 'Organization not found', code: 'NO_SUBSCRIPTION' }
  }

  const billing = orgSnap.data()?.billing as BillingDoc | undefined

  if (!billing?.status) {
    return { allowed: false, reason: 'No subscription found', code: 'NO_SUBSCRIPTION' }
  }

  const now = new Date()

  switch (billing.status as BillingStatusValue) {
    case 'trialing': {
      if (billing.trialEndsAt && now > billing.trialEndsAt.toDate()) {
        return {
          allowed: false,
          reason: 'Trial has expired. Contact Nuroo team to continue your subscription.',
          code: 'TRIAL_EXPIRED',
        }
      }
      return { allowed: true }
    }

    case 'active': {
      if (billing.currentPeriodEnd && now > billing.currentPeriodEnd.toDate()) {
        return {
          allowed: false,
          reason: 'Subscription period has ended',
          code: 'MANUAL_ACTIVE_EXPIRED',
        }
      }
      return { allowed: true }
    }

    case 'manual_active': {
      if (!billing.currentPeriodEnd) return { allowed: true }
      if (now > billing.currentPeriodEnd.toDate()) {
        return {
          allowed: false,
          reason: 'Manual subscription period has ended. Contact Nuroo team to renew.',
          code: 'MANUAL_ACTIVE_EXPIRED',
        }
      }
      return { allowed: true }
    }

    case 'past_due': {
      if (billing.updatedAt) {
        const gracePeriodEnd = new Date(
          billing.updatedAt.toDate().getTime() + PAST_DUE_GRACE_PERIOD_MS
        )
        if (now <= gracePeriodEnd) return { allowed: true }
      }
      return { allowed: false, reason: 'Payment is past due', code: 'PAST_DUE_GRACE_EXPIRED' }
    }

    case 'expired':
      return {
        allowed: false,
        reason: 'Subscription has expired. Contact Nuroo team to renew.',
        code: 'MANUAL_ACTIVE_EXPIRED',
      }

    case 'canceled':
    case 'cancelled':
      return { allowed: false, reason: 'Subscription has been canceled', code: 'CANCELED' }

    default:
      return { allowed: false, reason: 'Subscription is not active', code: 'NO_SUBSCRIPTION' }
  }
}
