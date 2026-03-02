import { getFirestore } from '../../infrastructure/database/firebase.js'
import { getBillingPlan, type BillingPlan } from './payments.repository.js'

export const PLAN_IDS = ['starter', 'growth', 'enterprise'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export interface PlanLimit {
  children: number | null
  specialists: number | null
}

export const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  starter: { children: 30, specialists: 3 },
  growth: { children: 80, specialists: null },
  enterprise: { children: null, specialists: null },
}

export function isPlanId(id: string): id is PlanId {
  return PLAN_IDS.includes(id as PlanId)
}

const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  basic: 'starter',
  professional: 'growth',
}

export function getPlanLimits(planId: string): PlanLimit | null {
  const mapped = LEGACY_PLAN_MAP[planId] ?? (isPlanId(planId) ? planId : null)
  if (!mapped) return null
  return PLAN_LIMITS[mapped]
}

export function isSubscriptionActive(billing: BillingPlan | null): boolean {
  if (!billing || billing.status !== 'active') return false
  const expiresAt = billing.expiresAt?.toDate?.()
  if (expiresAt && new Date() > expiresAt) return false
  return true
}

export async function getSubscriptionStatus(orgId: string): Promise<{
  active: boolean
  error?: string
  planId?: string
}> {
  const billing = await getBillingPlan(orgId)
  if (!billing) {
    return { active: false, error: 'No subscription. Please choose a plan and pay in Billing.' }
  }
  if (billing.status !== 'active') {
    return { active: false, error: 'Subscription is not active. Please renew in Billing.' }
  }
  const expiresAt = billing.expiresAt?.toDate?.()
  if (expiresAt && new Date() > expiresAt) {
    return { active: false, error: 'Subscription expired. Please renew in Billing.' }
  }
  return { active: true, planId: billing.planId }
}

export async function checkOrgCanAddChild(orgId: string): Promise<{ ok: boolean; error?: string }> {
  const status = await getSubscriptionStatus(orgId)
  if (!status.active) {
    return { ok: false, error: status.error ?? 'Subscription required.' }
  }
  const planId = status.planId ?? 'starter'
  const limits = getPlanLimits(planId)
  if (!limits) {
    return { ok: false, error: 'Invalid plan. Please renew in Billing.' }
  }
  if (limits.children === null) return { ok: true }
  const db = getFirestore()
  const childrenSnap = await db.collection('organizations').doc(orgId).collection('children').get()
  const count = childrenSnap.size
  if (count >= limits.children) {
    return {
      ok: false,
      error: `Plan limit: ${limits.children} children. Upgrade in Billing to add more.`,
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
  const planId = status.planId ?? 'starter'
  const limits = getPlanLimits(planId)
  if (!limits) {
    return { ok: false, error: 'Invalid plan. Please renew in Billing.' }
  }
  if (limits.specialists === null) return { ok: true }
  const db = getFirestore()
  const membersSnap = await db.collection('organizations').doc(orgId).collection('members').get()
  const count = membersSnap.size
  if (count >= limits.specialists) {
    return {
      ok: false,
      error: `Plan limit: ${limits.specialists} specialists. Upgrade in Billing to add more.`,
    }
  }
  return { ok: true }
}
