'use client'

/**
 * PlanGate — renders children when the current plan meets `requiredPlan`,
 * otherwise shows a professional upgrade overlay.
 *
 * Usage:
 *   <PlanGate requiredPlan="growth">
 *     <BrandPage />
 *   </PlanGate>
 */

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Lock, ArrowRight, Sparkles } from 'lucide-react'
import { usePlan } from '@/lib/b2b/planContext'
import { PLAN_LABEL, type PlanId } from '@/lib/pricing/planFeatureConfig'

interface PlanGateProps {
  /** Minimum plan required to access the wrapped content. */
  requiredPlan: PlanId
  children: React.ReactNode
  /** Optional: override the orgId for the billing link. Reads from URL if omitted. */
  orgId?: string
}

export function PlanGate({ requiredPlan, children, orgId }: PlanGateProps) {
  const { meetsPlan, planId, planIsLoading } = usePlan()
  const t = useTranslations('b2b.planGate')

  // While loading, assume access — avoids a jarring flash of the upgrade screen.
  if (planIsLoading) return <>{children}</>

  // Access granted.
  if (meetsPlan(requiredPlan)) return <>{children}</>

  // Build the upgrade link — preserve orgId query param so billing page knows the org.
  const billingHref = orgId ? `/b2b/billing?orgId=${orgId}` : '/b2b/billing'

  const currentLabel = PLAN_LABEL[planId ?? 'starter']
  const requiredLabel = PLAN_LABEL[requiredPlan]

  return (
    <div className="flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center">
        {/* Lock icon */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('heading', { plan: requiredLabel })}
        </h2>

        {/* Current plan badge */}
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
          {t('currentPlan', { plan: currentLabel })}
        </p>

        {/* Description */}
        <p className="text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
          {t('description', { required: requiredLabel })}
        </p>

        {/* What you get */}
        <div className="text-left bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-5 mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('includedInPlan', { plan: requiredLabel })}
          </p>
          <ul className="space-y-2">
            {(t.raw(`features_${requiredPlan}`) as string[]).map((item: string) => (
              <li
                key={item}
                className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2"
              >
                <span className="mt-0.5 w-4 h-4 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-600 dark:bg-primary-400 block" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <Link
          href={billingHref}
          className="inline-flex items-center justify-center gap-2 w-full rounded-2xl px-6 py-3.5 text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 transition-colors shadow-sm"
        >
          {t('cta', { plan: requiredLabel })}
          <ArrowRight className="w-4 h-4" />
        </Link>

        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">{t('noCancelRequired')}</p>
      </div>
    </div>
  )
}
