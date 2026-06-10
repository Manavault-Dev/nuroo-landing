/**
 * Single source of truth for plan pricing.
 *
 * Monthly and yearly prices are defined here.
 * UI components and checkout logic both import from this file.
 */

export type BillingPeriod = 'monthly' | 'yearly'

export interface PlanPrice {
  id: 'starter' | 'growth' | 'enterprise'
  monthlyPrice: number
  yearlyPrice: number
  currency: 'USD'
}

/** Yearly discount = 2 months free ≈ 16.7% → "Save ~17%" */
export const YEARLY_DISCOUNT_LABEL = '~17%'

export const PLAN_PRICES: PlanPrice[] = [
  { id: 'starter', monthlyPrice: 59, yearlyPrice: 590, currency: 'USD' },
  { id: 'growth', monthlyPrice: 99, yearlyPrice: 990, currency: 'USD' },
  { id: 'enterprise', monthlyPrice: 199, yearlyPrice: 1990, currency: 'USD' },
]

export function getPlanPrice(id: PlanPrice['id'], period: BillingPeriod): number {
  const plan = PLAN_PRICES.find((p) => p.id === id)
  if (!plan) return 0
  return period === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice
}

/**
 * What you would pay annually if you chose monthly billing.
 * Used to show the crossed-out "full" price beside the yearly price.
 * Example: starter = 59 × 12 = $708
 */
export function getMonthlyAnnualTotal(id: PlanPrice['id']): number {
  const plan = PLAN_PRICES.find((p) => p.id === id)
  if (!plan) return 0
  return plan.monthlyPrice * 12
}

/**
 * How much you save by choosing yearly over monthly billing.
 * Example: starter = 708 − 590 = $118
 */
export function getYearlySavings(id: PlanPrice['id']): number {
  const plan = PLAN_PRICES.find((p) => p.id === id)
  if (!plan) return 0
  return plan.monthlyPrice * 12 - plan.yearlyPrice
}

/**
 * Monthly equivalent when paying yearly (rounded down to nearest dollar).
 * Useful to help monthly-budget thinkers evaluate the yearly plan.
 * Example: starter = floor(590 / 12) = $49
 */
export function getMonthlyEquivalent(id: PlanPrice['id']): number {
  const plan = PLAN_PRICES.find((p) => p.id === id)
  if (!plan) return 0
  return Math.floor(plan.yearlyPrice / 12)
}
