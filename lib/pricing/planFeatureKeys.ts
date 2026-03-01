/**
 * Single source of truth for plan feature keys.
 * Both the landing Pricing component and the B2B billing page read from here,
 * so updating a feature text in landing.pricing messages updates both places.
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
    'starterF8',
  ],
  growth: [
    'growthF1',
    'growthF2',
    'growthF3',
    'growthF4',
    'growthF5',
    'growthF6',
    'growthF7',
    'growthF8',
  ],
  enterprise: ['entF1', 'entF2', 'entF3', 'entF4', 'entF6', 'entF7', 'entF8'],
} as const satisfies Record<string, readonly string[]>

export type PlanId = keyof typeof PLAN_FEATURE_KEYS
