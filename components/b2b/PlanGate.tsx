'use client'

/**
 * PlanGate — wraps content that requires Nuroo Business.
 *
 * Usage (page-level gate):
 *   return <PlanGate feature="branches"><BranchesContent /></PlanGate>
 *
 * Usage (inline):
 *   <PlanGate feature="org_finance" inline><FinanceTab /></PlanGate>
 */

import { type BusinessFeature, usePlanGate } from '@/lib/b2b/planGate'
import { UpgradeScreen } from './UpgradeScreen'

interface PlanGateProps {
  feature: BusinessFeature
  children: React.ReactNode
  /** Use inline upgrade banner instead of full-page screen */
  inline?: boolean
  upgradeHref?: string
}

export function PlanGate({ feature, children, inline = false, upgradeHref }: PlanGateProps) {
  const { can } = usePlanGate()

  if (can(feature)) return <>{children}</>

  if (inline) return <UpgradeScreen feature={feature} upgradeHref={upgradeHref} inline />

  return <UpgradeScreen feature={feature} upgradeHref={upgradeHref} />
}
