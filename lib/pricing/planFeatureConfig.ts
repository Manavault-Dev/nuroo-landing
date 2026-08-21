/**
 * Frontend plan feature configuration.
 *
 * Mirrors the plan capabilities from backend/src/modules/payments/planLimits.ts
 * without any Firebase/Node dependencies so it can run in the browser.
 *
 * Single source of truth for UI-level plan gating (PlanGate, Sidebar lock badges, etc.)
 */

export type PlanId = 'starter' | 'growth' | 'enterprise'

/** Canonical rank for plan comparison. Higher = more capable plan. */
export const PLAN_RANK: Record<PlanId, number> = {
  starter: 0,
  growth: 1,
  enterprise: 2,
}

/** Features that require a plan upgrade to access. */
export type GatedFeature =
  | 'branding'
  | 'advancedAnalytics'
  | 'csvExport'
  | 'advancedRoles'
  | 'teamManagement'
  | 'branches'
  | 'finance'
  | 'dedicatedOnboarding'
  | 'customIntegrations'

/** Which is the minimum plan that unlocks each feature. */
export const FEATURE_MIN_PLAN: Record<GatedFeature, PlanId> = {
  branding: 'growth',
  advancedAnalytics: 'growth',
  csvExport: 'growth',
  advancedRoles: 'growth',
  teamManagement: 'growth',
  branches: 'enterprise',
  finance: 'enterprise',
  dedicatedOnboarding: 'enterprise',
  customIntegrations: 'enterprise',
}

/**
 * Normalize a raw plan string (including legacy aliases) to a canonical PlanId.
 * Falls back to 'starter' when the string is unknown.
 */
export function normalizePlanIdFE(raw: string | null | undefined): PlanId {
  const value = raw?.trim().toLowerCase()
  if (!value) return 'starter'
  if (value === 'professional' || value === 'pro') return 'growth'
  if (value === 'basic') return 'starter'
  if (value === 'corporate' || value === 'corp' || value === 'корпоративный') return 'enterprise'
  if (value === 'starter' || value === 'growth' || value === 'enterprise') return value as PlanId
  // Nuroo product plan aliases → billing plan equivalents
  if (value === 'nuroo') return 'starter'
  if (value === 'nuroo_business') return 'enterprise'
  return 'starter'
}

/**
 * Returns true when `currentPlanId` meets or exceeds `requiredPlan`.
 */
export function planMeetsRequirement(
  currentPlanId: string | null | undefined,
  requiredPlan: PlanId
): boolean {
  const current = PLAN_RANK[normalizePlanIdFE(currentPlanId)]
  const required = PLAN_RANK[requiredPlan]
  return current >= required
}

/**
 * Returns true when the current plan includes the given feature.
 */
export function planHasFeature(
  currentPlanId: string | null | undefined,
  feature: GatedFeature
): boolean {
  return planMeetsRequirement(currentPlanId, FEATURE_MIN_PLAN[feature])
}

/** Human-readable plan label for UI copy. */
export const PLAN_LABEL: Record<PlanId, string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
}
