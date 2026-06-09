import { describe, it, expect } from 'vitest'
import { getSubscriptionState, calcDaysRemaining } from '../lib/b2b/subscriptionState'

// ── calcDaysRemaining ─────────────────────────────────────────────────────────

describe('calcDaysRemaining', () => {
  it('returns null for null input', () => {
    expect(calcDaysRemaining(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(calcDaysRemaining(undefined)).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(calcDaysRemaining('not-a-date')).toBeNull()
  })

  it('returns 0 for a past date', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    expect(calcDaysRemaining(yesterday)).toBe(0)
  })

  it('returns a positive number for a future date', () => {
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(calcDaysRemaining(future)).toBeGreaterThan(0)
  })
})

// ── BDD Scenario helpers ──────────────────────────────────────────────────────

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}
function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

// ── Scenario 1: Active subscription ──────────────────────────────────────────

describe('Scenario 1 — active subscription', () => {
  it('returns full access with no banner', () => {
    const state = getSubscriptionState('active', daysFromNow(30), true)
    expect(state.isActive).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
    expect(state.bannerType).toBe('none')
    expect(state.blockType).toBe('none')
    expect(state.status).toBe('active')
  })

  it('manual_active also returns full access', () => {
    const state = getSubscriptionState('manual_active', daysFromNow(30), true)
    expect(state.isActive).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
    expect(state.bannerType).toBe('none')
  })
})

// ── Scenario 2: Trial active (> 7 days) ──────────────────────────────────────

describe('Scenario 2 — trial active, more than 7 days remaining', () => {
  it('returns full access with trial_active banner', () => {
    const state = getSubscriptionState('trialing', daysFromNow(20), true)
    expect(state.isTrial).toBe(true)
    expect(state.isActive).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
    expect(state.bannerType).toBe('trial_active')
    expect(state.blockType).toBe('none')
    expect(state.isExpiringSoon).toBe(false)
    expect(state.daysRemaining).toBeGreaterThan(7)
    expect(state.status).toBe('trial')
  })
})

// ── Scenario 3: Trial expiring (≤ 7 days) ────────────────────────────────────

describe('Scenario 3 — trial expiring within 7 days', () => {
  it('returns full access with trial_expiring banner', () => {
    const state = getSubscriptionState('trialing', daysFromNow(3), true)
    expect(state.isTrial).toBe(true)
    expect(state.isActive).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
    expect(state.bannerType).toBe('trial_expiring')
    expect(state.blockType).toBe('none')
    expect(state.isExpiringSoon).toBe(true)
    expect(state.daysRemaining).toBeLessThanOrEqual(7)
    expect(state.ctaLabel).toBe('Choose Plan')
    expect(state.status).toBe('trial_expiring')
  })

  it('exact boundary — 7 days is still expiring', () => {
    const state = getSubscriptionState('trialing', daysFromNow(7), true)
    expect(state.bannerType).toBe('trial_expiring')
    expect(state.isExpiringSoon).toBe(true)
  })

  it('8 days is NOT expiring soon', () => {
    const state = getSubscriptionState('trialing', daysFromNow(8), true)
    expect(state.bannerType).toBe('trial_active')
    expect(state.isExpiringSoon).toBe(false)
  })
})

// ── Scenario 4: Trial expired ─────────────────────────────────────────────────

describe('Scenario 4 — trial expired', () => {
  it('blocks workspace, billing remains accessible', () => {
    const state = getSubscriptionState('trialing', daysAgo(1), false)
    expect(state.isExpired).toBe(true)
    expect(state.isActive).toBe(false)
    expect(state.canAccessWorkspace).toBe(false)
    expect(state.canAccessBilling).toBe(true)
    expect(state.blockType).toBe('expired')
    expect(state.bannerType).toBe('none')
    expect(state.status).toBe('expired')
  })

  it('billingStatus=expired also blocks', () => {
    const state = getSubscriptionState('expired', daysAgo(5), false)
    expect(state.canAccessWorkspace).toBe(false)
    expect(state.blockType).toBe('expired')
  })

  it('cancelled status blocks workspace', () => {
    const state = getSubscriptionState('cancelled', null, false)
    expect(state.canAccessWorkspace).toBe(false)
    expect(state.blockType).toBe('expired')
  })

  it('message mentions data is safe', () => {
    const state = getSubscriptionState('expired', null, false)
    expect(state.message.toLowerCase()).toContain('safe')
  })
})

// ── Scenario 5: Past due ──────────────────────────────────────────────────────

describe('Scenario 5 — past due', () => {
  it('shows past_due banner but keeps workspace accessible', () => {
    const state = getSubscriptionState('past_due', null, true)
    expect(state.isPastDue).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
    expect(state.canAccessBilling).toBe(true)
    expect(state.bannerType).toBe('past_due')
    expect(state.blockType).toBe('none')
    expect(state.status).toBe('past_due')
  })
})

// ── Scenario 6: Suspended ─────────────────────────────────────────────────────

describe('Scenario 6 — suspended', () => {
  it('blocks workspace, keeps billing accessible', () => {
    const state = getSubscriptionState('suspended', null, false)
    expect(state.isSuspended).toBe(true)
    expect(state.canAccessWorkspace).toBe(false)
    expect(state.canAccessBilling).toBe(true)
    expect(state.blockType).toBe('suspended')
    expect(state.bannerType).toBe('none')
    expect(state.status).toBe('suspended')
  })
})

// ── Scenario 7: Missing / unknown fields ──────────────────────────────────────

describe('Scenario 7 — missing subscription fields', () => {
  it('does not crash when billingStatus is null and active is false', () => {
    expect(() => getSubscriptionState(null, null, false)).not.toThrow()
    const state = getSubscriptionState(null, null, false)
    expect(state.canAccessBilling).toBe(true)
  })

  it('does not crash when billingStatus is undefined', () => {
    expect(() => getSubscriptionState(undefined, undefined, false)).not.toThrow()
  })

  it('treats null billingStatus + active=true as active', () => {
    // Backend says active — trust it even without a status string
    const state = getSubscriptionState(null, null, true)
    expect(state.isActive).toBe(true)
    expect(state.canAccessWorkspace).toBe(true)
  })

  it('unknown state always allows billing access', () => {
    const state = getSubscriptionState(undefined, undefined, false)
    expect(state.canAccessBilling).toBe(true)
  })
})
