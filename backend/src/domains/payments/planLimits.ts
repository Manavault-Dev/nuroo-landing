import admin from 'firebase-admin'
import { getFirestore } from '../../infrastructure/database/firebase.js'
import { getBillingPlan, type BillingPlan } from './payments.repository.js'

export const PLAN_IDS = ['starter', 'growth', 'enterprise'] as const
export type PlanId = (typeof PLAN_IDS)[number]
export type SubscriptionAccessSource = 'subscription' | 'free_trial'
export type BillingStatus =
  | 'trialing'
  | 'active'
  | 'manual_active'
  | 'past_due'
  | 'expired'
  | 'cancelled'
  | 'canceled'

export const FREE_TRIAL_DAYS = 30
// Trial gives Enterprise level access (30 days)
export const FREE_TRIAL_PLAN_ID: PlanId = 'enterprise'

export interface PlanFeatures {
  branding: boolean
  advancedAnalytics: boolean
  csvExport: boolean
  advancedRoles: boolean
  teamManagement: boolean
  branches: boolean
  finance: boolean
  dedicatedOnboarding: boolean
  customIntegrations: boolean
}

export interface PlanConfig {
  priceUsd: number
  maxChildren: number | null
  maxSpecialists: number | null
  features: PlanFeatures
}

export const PLAN_CONFIG: Record<PlanId, PlanConfig> = {
  starter: {
    priceUsd: 59,
    maxChildren: 30,
    maxSpecialists: 3,
    features: {
      branding: false,
      advancedAnalytics: false,
      csvExport: false,
      advancedRoles: false,
      teamManagement: false,
      branches: false,
      finance: false,
      dedicatedOnboarding: false,
      customIntegrations: false,
    },
  },
  growth: {
    priceUsd: 99,
    maxChildren: 80,
    maxSpecialists: null, // unlimited, as advertised on pricing page
    features: {
      branding: true,
      advancedAnalytics: true,
      csvExport: true,
      advancedRoles: true,
      teamManagement: true,
      branches: false,
      finance: false,
      dedicatedOnboarding: false,
      customIntegrations: false,
    },
  },
  enterprise: {
    priceUsd: 199,
    maxChildren: null,
    maxSpecialists: null,
    features: {
      branding: true,
      advancedAnalytics: true,
      csvExport: true,
      advancedRoles: true,
      teamManagement: true,
      branches: true,
      finance: true,
      dedicatedOnboarding: true,
      customIntegrations: true,
    },
  },
}

// Keep for backward compatibility
export interface PlanLimit {
  children: number | null
  specialists: number | null
}

export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  starter: {
    children: PLAN_CONFIG.starter.maxChildren, // 30 — matches landing/pricing copy
    specialists: PLAN_CONFIG.starter.maxSpecialists,
  },
  growth: {
    children: PLAN_CONFIG.growth.maxChildren,
    specialists: PLAN_CONFIG.growth.maxSpecialists,
  },
  enterprise: { children: null, specialists: null },
}

export function isPlanId(id: string): id is PlanId {
  return PLAN_IDS.includes(id as PlanId)
}

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  basic: 'starter',
  professional: 'growth',
  pro: 'growth',
  corporate: 'enterprise',
  corp: 'enterprise',
  корпоративный: 'enterprise',
}

export function normalizePlanId(id: string): PlanId | null {
  const value = id.trim().toLowerCase()
  return LEGACY_PLAN_MAP[value] ?? (isPlanId(value) ? value : null)
}

function normalizeBillingStatusValue(status: unknown): BillingStatus | null {
  if (typeof status !== 'string') return null
  const value = status.trim().toLowerCase()
  if (normalizePlanId(value)) return 'manual_active'
  if (
    value === 'trialing' ||
    value === 'active' ||
    value === 'manual_active' ||
    value === 'past_due' ||
    value === 'expired' ||
    value === 'cancelled' ||
    value === 'canceled'
  ) {
    return value
  }
  return null
}

export function getPlanLimits(planId: string): PlanLimit | null {
  const mapped = normalizePlanId(planId)
  if (!mapped) return null
  return PLAN_LIMITS[mapped]
}

export function getPlanConfig(planId: string): PlanConfig | null {
  const mapped = normalizePlanId(planId)
  if (!mapped) return null
  return PLAN_CONFIG[mapped]
}

function timestampToDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

export function isSubscriptionActive(billing: BillingPlan | null): boolean {
  if (!billing || billing.status !== 'active') return false
  const expiresAt = billing.expiresAt?.toDate?.()
  if (expiresAt && new Date() > expiresAt) return false
  return true
}

export async function getFreeTrialStatus(orgId: string): Promise<{
  active: boolean
  error?: string
  planId: string | null
  startedAt?: admin.firestore.Timestamp | null
  expiresAt?: admin.firestore.Timestamp | null
} | null> {
  const db = getFirestore()
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  if (!orgSnap.exists) return null

  const trial = orgSnap.data()?.freeTrial
  if (!trial) return null

  const planId = typeof trial.planId === 'string' ? trial.planId : FREE_TRIAL_PLAN_ID
  const normalizedPlanId = normalizePlanId(planId) ?? FREE_TRIAL_PLAN_ID

  const expiresAt = trial.expiresAt?.toDate?.()
  if (!expiresAt) {
    return {
      active: false,
      error: 'Free trial is missing an expiration date. Please choose a plan in Billing.',
      planId: normalizedPlanId,
      startedAt: trial.startedAt ?? null,
      expiresAt: trial.expiresAt ?? null,
    }
  }

  if (new Date() > expiresAt) {
    return {
      active: false,
      error: 'Free trial expired. Please choose a plan and pay in Billing.',
      planId: normalizedPlanId,
      startedAt: trial.startedAt ?? null,
      expiresAt: trial.expiresAt ?? null,
    }
  }

  return {
    active: true,
    planId: normalizedPlanId,
    startedAt: trial.startedAt ?? null,
    expiresAt: trial.expiresAt ?? null,
  }
}

export async function getSubscriptionStatus(orgId: string): Promise<{
  active: boolean
  error?: string
  planId?: string
  source?: SubscriptionAccessSource
  billingStatus?: BillingStatus
  expiresAt?: admin.firestore.Timestamp | null
}> {
  const billing = await getBillingPlan(orgId)
  if (billing) {
    if (billing.status !== 'active') {
      return {
        active: false,
        error: 'Subscription is not active. Please renew in Billing.',
        source: 'subscription',
        billingStatus: billing.status === 'cancelled' ? 'cancelled' : 'expired',
        expiresAt: billing.expiresAt ?? null,
      }
    }
    const expiresAt = billing.expiresAt?.toDate?.()
    if (expiresAt && new Date() > expiresAt) {
      return {
        active: false,
        error: 'Subscription expired. Please renew in Billing.',
        source: 'subscription',
        billingStatus: 'expired',
        expiresAt: billing.expiresAt ?? null,
      }
    }
    return {
      active: true,
      planId: billing.planId,
      source: 'subscription',
      billingStatus: 'active',
      expiresAt: billing.expiresAt ?? null,
    }
  }

  const db = getFirestore()
  const orgSnap = await db.collection('organizations').doc(orgId).get()
  const orgBilling = orgSnap.exists ? orgSnap.data()?.billing : null
  if (orgBilling) {
    const billingStatus = normalizeBillingStatusValue(orgBilling.status)
    const planId =
      normalizePlanId(String(orgBilling.plan ?? FREE_TRIAL_PLAN_ID)) ?? FREE_TRIAL_PLAN_ID
    const trialEndsAt = timestampToDate(orgBilling.trialEndsAt)
    const currentPeriodEnd = timestampToDate(orgBilling.currentPeriodEnd)

    if (billingStatus === 'trialing') {
      if (trialEndsAt && new Date() <= trialEndsAt) {
        return {
          active: true,
          planId: FREE_TRIAL_PLAN_ID,
          source: 'free_trial',
          billingStatus: 'trialing',
          expiresAt: orgBilling.trialEndsAt ?? null,
        }
      }
      return {
        active: false,
        error: 'Free trial expired. Please choose a plan and pay in Billing.',
        source: 'free_trial',
        billingStatus: 'expired',
        expiresAt: orgBilling.trialEndsAt ?? null,
      }
    }

    if (billingStatus === 'manual_active' || billingStatus === 'active') {
      if (!currentPeriodEnd || new Date() <= currentPeriodEnd) {
        return {
          active: true,
          planId,
          source: 'subscription',
          billingStatus,
          expiresAt: orgBilling.currentPeriodEnd ?? null,
        }
      }
      return {
        active: false,
        error: 'Subscription expired. Please renew in Billing.',
        source: 'subscription',
        billingStatus: 'expired',
        expiresAt: orgBilling.currentPeriodEnd ?? null,
      }
    }
  }

  const trial = await getFreeTrialStatus(orgId)
  if (trial?.active && trial.planId) {
    return {
      active: true,
      planId: trial.planId,
      source: 'free_trial',
      billingStatus: 'trialing',
      expiresAt: trial.expiresAt ?? null,
    }
  }

  if (trial && !trial.active) {
    return {
      active: false,
      error: trial.error ?? 'Free trial expired. Please choose a plan and pay in Billing.',
      source: 'free_trial',
      billingStatus: 'expired',
      expiresAt: trial.expiresAt ?? null,
    }
  }

  return {
    active: false,
    error: 'No subscription. Please choose a plan and pay in Billing.',
    billingStatus: 'expired',
  }
}

export function getBillingBadgeKey(billingStatus: BillingStatus | undefined): string {
  switch (billingStatus) {
    case 'trialing':
      return 'freeTrial'
    case 'active':
      return 'active'
    case 'manual_active':
      return 'active'
    case 'past_due':
      return 'pastDue'
    case 'expired':
      return 'expired'
    case 'canceled':
    case 'cancelled':
      return 'cancelled'
    default:
      return 'expired'
  }
}

export async function hasFeature(orgId: string, feature: keyof PlanFeatures): Promise<boolean> {
  const status = await getSubscriptionStatus(orgId)
  if (!status.active) return false
  const planId = normalizePlanId(status.planId ?? 'starter') ?? 'starter'
  return PLAN_CONFIG[planId].features[feature] === true
}

export async function checkOrgCanAddChild(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const status = await getSubscriptionStatus(orgId)
  if (!status.active) {
    return { ok: false, error: status.error ?? 'Subscription required.' }
  }
  const planId = normalizePlanId(status.planId ?? 'starter') ?? 'starter'
  const { maxChildren } = PLAN_CONFIG[planId]
  if (maxChildren === null) return { ok: true }
  const db = getFirestore()
  const snap = await db.collection('organizations').doc(orgId).collection('children').get()
  if (snap.size >= maxChildren) {
    return {
      ok: false,
      error: `You've reached the limit of ${maxChildren} children on your current plan. Upgrade to continue.`,
    }
  }
  return { ok: true }
}

export async function checkOrgCanAddSpecialist(
  orgId: string
): Promise<{ ok: boolean; error?: string }> {
  const status = await getSubscriptionStatus(orgId)
  if (!status.active) {
    return { ok: false, error: status.error ?? 'Subscription required.' }
  }
  const planId = normalizePlanId(status.planId ?? 'starter') ?? 'starter'
  const { maxSpecialists } = PLAN_CONFIG[planId]
  if (maxSpecialists === null) return { ok: true }
  const db = getFirestore()
  const snap = await db.collection('organizations').doc(orgId).collection('members').get()
  if (snap.size >= maxSpecialists) {
    return {
      ok: false,
      error: `You've reached the limit of ${maxSpecialists} specialists on your current plan. Upgrade to continue.`,
    }
  }
  return { ok: true }
}

export async function checkOrgHasFeature(
  orgId: string,
  feature: keyof PlanFeatures
): Promise<{ ok: boolean; error?: string }> {
  const ok = await hasFeature(orgId, feature)
  if (!ok) {
    const featureLabels: Record<keyof PlanFeatures, string> = {
      branding: 'White-label branding (Growth plan)',
      advancedAnalytics: 'Advanced analytics (Growth plan)',
      csvExport: 'CSV/PDF export (Growth plan)',
      advancedRoles: 'Advanced roles (Growth plan)',
      teamManagement: 'Team management (Growth plan)',
      branches: 'Multiple branches (Enterprise plan)',
      finance: 'Finance module (Enterprise plan)',
      dedicatedOnboarding: 'Dedicated onboarding (Enterprise plan)',
      customIntegrations: 'Custom integrations (Enterprise plan)',
    }
    return {
      ok: false,
      error: `${featureLabels[feature]} is not included in your current plan. Upgrade to continue.`,
    }
  }
  return { ok: true }
}
