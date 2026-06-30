'use client'

/**
 * PlanContext — provides the current organization's plan ID to all B2B components.
 *
 * The layout fetches billingData once per org-switch and passes planId here.
 * Child components read via usePlan() — no extra API calls.
 */

import { createContext, useContext, type ReactNode } from 'react'
import {
  normalizePlanIdFE,
  planMeetsRequirement,
  planHasFeature,
  type PlanId,
  type GatedFeature,
} from '@/lib/pricing/planFeatureConfig'

interface PlanContextValue {
  /** Canonical plan id, null while loading */
  planId: PlanId | null
  /** True while billingData is still being fetched */
  planIsLoading: boolean
  /** Whether the current plan unlocks the given feature */
  hasFeature: (feature: GatedFeature) => boolean
  /** Whether the current plan is at least `required` */
  meetsPlan: (required: PlanId) => boolean
}

// Optimistic defaults: while loading, grant full access so no lock icons flash
const PlanContext = createContext<PlanContextValue>({
  planId: null,
  planIsLoading: true,
  hasFeature: () => true,
  meetsPlan: () => true,
})

interface PlanProviderProps {
  children: ReactNode
  /**
   * Raw plan id string from billingData (may be legacy alias like "professional").
   * Pass null while loading.
   */
  rawPlanId: string | null | undefined
  isLoading: boolean
}

export function PlanProvider({ children, rawPlanId, isLoading }: PlanProviderProps) {
  const planId = isLoading ? null : normalizePlanIdFE(rawPlanId)

  const value: PlanContextValue = {
    planId,
    planIsLoading: isLoading,
    hasFeature: (feature) => (isLoading ? true : planHasFeature(planId, feature)),
    meetsPlan: (required) => (isLoading ? true : planMeetsRequirement(planId, required)),
  }

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

/** Read the current org plan from anywhere inside B2BLayout. */
export function usePlan(): PlanContextValue {
  return useContext(PlanContext)
}
