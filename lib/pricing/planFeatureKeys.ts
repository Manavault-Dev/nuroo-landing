/**
 * Single source of truth for plan feature keys.
 * Both the landing Pricing component and the B2B billing page read from here,
 * so updating a feature text in landing.pricing messages updates both places.
 *
 * NOTE: The backend payment system uses plan IDs 'starter' | 'growth' | 'enterprise'.
 * 'professional' is the display alias for 'growth' — same plan, new name.
 */
export const PLAN_FEATURE_KEYS = {
  starter: [
    'starterF1',
    'starterF2',
    'starterF3',
    'starterF4',
    'starterF5',
    'starterF6',
    'starterF7',
  ],
  professional: ['proF1', 'proF2', 'proF4', 'proF5', 'proF6', 'proF7', 'proF9'],
  /** Alias for 'professional' — used when backend returns planId 'growth' */
  growth: ['proF1', 'proF2', 'proF4', 'proF5', 'proF6', 'proF7', 'proF9'],
  enterprise: ['entF1', 'entF2', 'entF3', 'entF5', 'entF8', 'entF10'],
} as const satisfies Record<string, readonly string[]>

export type PlanId = keyof typeof PLAN_FEATURE_KEYS
