import { describe, it, expect } from 'vitest'
import {
  PLAN_PRICES,
  YEARLY_DISCOUNT_LABEL,
  getPlanPrice,
  getMonthlyAnnualTotal,
  getYearlySavings,
  getMonthlyEquivalent,
  type BillingPeriod,
} from '../lib/pricing/pricingConfig'

describe('PLAN_PRICES', () => {
  it('contains exactly 3 plans', () => {
    expect(PLAN_PRICES).toHaveLength(3)
  })

  it('has correct plan ids', () => {
    const ids = PLAN_PRICES.map((p) => p.id)
    expect(ids).toEqual(['starter', 'growth', 'enterprise'])
  })

  it('all plans use USD currency', () => {
    PLAN_PRICES.forEach((p) => expect(p.currency).toBe('USD'))
  })

  it('starter monthly price is $59', () => {
    const starter = PLAN_PRICES.find((p) => p.id === 'starter')!
    expect(starter.monthlyPrice).toBe(59)
  })

  it('growth monthly price is $99', () => {
    const growth = PLAN_PRICES.find((p) => p.id === 'growth')!
    expect(growth.monthlyPrice).toBe(99)
  })

  it('enterprise monthly price is $199', () => {
    const enterprise = PLAN_PRICES.find((p) => p.id === 'enterprise')!
    expect(enterprise.monthlyPrice).toBe(199)
  })

  it('starter yearly price is $590', () => {
    const starter = PLAN_PRICES.find((p) => p.id === 'starter')!
    expect(starter.yearlyPrice).toBe(590)
  })

  it('growth yearly price is $990', () => {
    const growth = PLAN_PRICES.find((p) => p.id === 'growth')!
    expect(growth.yearlyPrice).toBe(990)
  })

  it('enterprise yearly price is $1990', () => {
    const enterprise = PLAN_PRICES.find((p) => p.id === 'enterprise')!
    expect(enterprise.yearlyPrice).toBe(1990)
  })

  it('yearly price equals 10 months — approximately 17% discount', () => {
    PLAN_PRICES.forEach((p) => {
      const tenMonths = p.monthlyPrice * 10
      expect(p.yearlyPrice).toBe(tenMonths)
    })
  })
})

describe('getPlanPrice', () => {
  it('returns monthly price for monthly period', () => {
    expect(getPlanPrice('starter', 'monthly')).toBe(59)
    expect(getPlanPrice('growth', 'monthly')).toBe(99)
    expect(getPlanPrice('enterprise', 'monthly')).toBe(199)
  })

  it('returns yearly price for yearly period', () => {
    expect(getPlanPrice('starter', 'yearly')).toBe(590)
    expect(getPlanPrice('growth', 'yearly')).toBe(990)
    expect(getPlanPrice('enterprise', 'yearly')).toBe(1990)
  })

  it('BillingPeriod toggle changes price', () => {
    const period: BillingPeriod = 'yearly'
    expect(getPlanPrice('growth', period)).toBe(990)
  })
})

describe('YEARLY_DISCOUNT_LABEL', () => {
  it('contains 17% label', () => {
    expect(YEARLY_DISCOUNT_LABEL).toBe('~17%')
  })
})

describe('getMonthlyAnnualTotal', () => {
  it('starter: 59 × 12 = 708', () => {
    expect(getMonthlyAnnualTotal('starter')).toBe(708)
  })

  it('growth: 99 × 12 = 1188', () => {
    expect(getMonthlyAnnualTotal('growth')).toBe(1188)
  })

  it('enterprise: 199 × 12 = 2388', () => {
    expect(getMonthlyAnnualTotal('enterprise')).toBe(2388)
  })

  it('returns 0 for unknown plan id', () => {
    // @ts-expect-error — intentional invalid id for guard test
    expect(getMonthlyAnnualTotal('unknown')).toBe(0)
  })
})

describe('getYearlySavings', () => {
  it('starter saves $118 with yearly plan', () => {
    expect(getYearlySavings('starter')).toBe(118)
  })

  it('growth saves $198 with yearly plan', () => {
    expect(getYearlySavings('growth')).toBe(198)
  })

  it('enterprise saves $398 with yearly plan', () => {
    expect(getYearlySavings('enterprise')).toBe(398)
  })

  it('savings = monthly annual total minus yearly price', () => {
    PLAN_PRICES.forEach((p) => {
      expect(getYearlySavings(p.id)).toBe(p.monthlyPrice * 12 - p.yearlyPrice)
    })
  })

  it('returns 0 for unknown plan id', () => {
    // @ts-expect-error — intentional invalid id for guard test
    expect(getYearlySavings('unknown')).toBe(0)
  })
})

describe('getMonthlyEquivalent', () => {
  it('starter yearly ≈ $49/month', () => {
    // floor(590 / 12) = floor(49.16) = 49
    expect(getMonthlyEquivalent('starter')).toBe(49)
  })

  it('growth yearly ≈ $82/month', () => {
    // floor(990 / 12) = floor(82.5) = 82
    expect(getMonthlyEquivalent('growth')).toBe(82)
  })

  it('enterprise yearly ≈ $165/month', () => {
    // floor(1990 / 12) = floor(165.83) = 165
    expect(getMonthlyEquivalent('enterprise')).toBe(165)
  })

  it('monthly equivalent is always less than monthly price', () => {
    PLAN_PRICES.forEach((p) => {
      expect(getMonthlyEquivalent(p.id)).toBeLessThan(p.monthlyPrice)
    })
  })

  it('returns 0 for unknown plan id', () => {
    // @ts-expect-error — intentional invalid id for guard test
    expect(getMonthlyEquivalent('unknown')).toBe(0)
  })
})
