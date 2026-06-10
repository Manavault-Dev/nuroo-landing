import { describe, it, expect } from 'vitest'
import {
  PLAN_RANK,
  FEATURE_MIN_PLAN,
  normalizePlanIdFE,
  planMeetsRequirement,
  planHasFeature,
  PLAN_LABEL,
} from '../lib/pricing/planFeatureConfig'

describe('PLAN_RANK', () => {
  it('enterprise ranks higher than growth', () => {
    expect(PLAN_RANK.enterprise).toBeGreaterThan(PLAN_RANK.growth)
  })

  it('growth ranks higher than starter', () => {
    expect(PLAN_RANK.growth).toBeGreaterThan(PLAN_RANK.starter)
  })
})

describe('normalizePlanIdFE', () => {
  it('passes through canonical ids unchanged', () => {
    expect(normalizePlanIdFE('starter')).toBe('starter')
    expect(normalizePlanIdFE('growth')).toBe('growth')
    expect(normalizePlanIdFE('enterprise')).toBe('enterprise')
  })

  it('maps legacy "professional" to "growth"', () => {
    expect(normalizePlanIdFE('professional')).toBe('growth')
  })

  it('maps legacy "basic" to "starter"', () => {
    expect(normalizePlanIdFE('basic')).toBe('starter')
  })

  it('falls back to starter for unknown strings', () => {
    expect(normalizePlanIdFE('unknown_plan')).toBe('starter')
    expect(normalizePlanIdFE('')).toBe('starter')
  })

  it('falls back to starter for null', () => {
    expect(normalizePlanIdFE(null)).toBe('starter')
  })

  it('falls back to starter for undefined', () => {
    expect(normalizePlanIdFE(undefined)).toBe('starter')
  })
})

describe('planMeetsRequirement', () => {
  it('starter does NOT meet growth requirement', () => {
    expect(planMeetsRequirement('starter', 'growth')).toBe(false)
  })

  it('starter does NOT meet enterprise requirement', () => {
    expect(planMeetsRequirement('starter', 'enterprise')).toBe(false)
  })

  it('growth meets growth requirement', () => {
    expect(planMeetsRequirement('growth', 'growth')).toBe(true)
  })

  it('growth does NOT meet enterprise requirement', () => {
    expect(planMeetsRequirement('growth', 'enterprise')).toBe(false)
  })

  it('enterprise meets growth requirement', () => {
    expect(planMeetsRequirement('enterprise', 'growth')).toBe(true)
  })

  it('enterprise meets enterprise requirement', () => {
    expect(planMeetsRequirement('enterprise', 'enterprise')).toBe(true)
  })

  it('null (loading state) does NOT meet any requirement', () => {
    expect(planMeetsRequirement(null, 'growth')).toBe(false)
    expect(planMeetsRequirement(null, 'enterprise')).toBe(false)
  })
})

describe('planHasFeature', () => {
  it('starter has no branding', () => {
    expect(planHasFeature('starter', 'branding')).toBe(false)
  })

  it('growth has branding', () => {
    expect(planHasFeature('growth', 'branding')).toBe(true)
  })

  it('enterprise has branding', () => {
    expect(planHasFeature('enterprise', 'branding')).toBe(true)
  })

  it('starter has no finance module', () => {
    expect(planHasFeature('starter', 'finance')).toBe(false)
  })

  it('growth has no finance module', () => {
    expect(planHasFeature('growth', 'finance')).toBe(false)
  })

  it('enterprise has finance module', () => {
    expect(planHasFeature('enterprise', 'finance')).toBe(true)
  })

  it('starter has no branches', () => {
    expect(planHasFeature('starter', 'branches')).toBe(false)
  })

  it('growth has no branches', () => {
    expect(planHasFeature('growth', 'branches')).toBe(false)
  })

  it('enterprise has branches', () => {
    expect(planHasFeature('enterprise', 'branches')).toBe(true)
  })

  it('starter has no csvExport', () => {
    expect(planHasFeature('starter', 'csvExport')).toBe(false)
  })

  it('growth has csvExport', () => {
    expect(planHasFeature('growth', 'csvExport')).toBe(true)
  })

  it('enterprise has all features', () => {
    const allFeatures = Object.keys(FEATURE_MIN_PLAN) as (keyof typeof FEATURE_MIN_PLAN)[]
    allFeatures.forEach((feature) => {
      expect(planHasFeature('enterprise', feature)).toBe(true)
    })
  })
})

describe('PLAN_LABEL', () => {
  it('has human-readable labels for all plans', () => {
    expect(PLAN_LABEL.starter).toBe('Starter')
    expect(PLAN_LABEL.growth).toBe('Growth')
    expect(PLAN_LABEL.enterprise).toBe('Enterprise')
  })
})
