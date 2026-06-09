'use client'

import { useRouter } from '@/i18n/navigation'
import {
  ShieldOff,
  Database,
  Users,
  Brain,
  TrendingUp,
  CreditCard,
  LifeBuoy,
  Lock,
} from 'lucide-react'
import type { SubscriptionBlockType } from '@/lib/b2b/subscriptionState'

interface Props {
  blockType: Exclude<SubscriptionBlockType, 'none'>
  message: string
  ctaLabel: string
  orgId?: string | null
}

const VALUE_POINTS = [
  { icon: Users, label: 'Parent management & family connections' },
  { icon: Brain, label: 'AI-assisted activity planning' },
  { icon: TrendingUp, label: 'Progress tracking & analytics' },
  { icon: CreditCard, label: 'Billing & payment collection' },
  { icon: Database, label: 'Your data is always safe' },
]

export function SubscriptionPaywall({ blockType, message, ctaLabel, orgId }: Props) {
  const router = useRouter()

  const title = blockType === 'suspended' ? 'Workspace Suspended' : 'Subscription Required'

  const subtitle =
    blockType === 'suspended'
      ? 'Your workspace has been suspended. Your data is safe and intact.'
      : 'Your Nuroo access has ended, but your data is safe.'

  const handleChoosePlan = () => {
    const href = orgId ? `/b2b/billing?orgId=${orgId}` : '/b2b/billing'
    router.push(href)
  }

  const handleSupport = () => {
    window.location.href = 'mailto:support@nuroo.io'
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-950/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-primary-500 to-primary-700" />

        <div className="p-8">
          {/* Icon + title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
              {blockType === 'suspended' ? (
                <ShieldOff className="w-6 h-6 text-red-500" />
              ) : (
                <Lock className="w-6 h-6 text-red-500" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
            </div>
          </div>

          {/* Main message */}
          <p className="text-gray-700 text-sm mb-6 leading-relaxed">{message}</p>

          {/* Value points — only shown for expired, not suspended */}
          {blockType === 'expired' && (
            <ul className="space-y-2.5 mb-8">
              {VALUE_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-sm text-gray-600">
                  <div className="w-6 h-6 rounded-full bg-primary-50 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                  {label}
                </li>
              ))}
            </ul>
          )}

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            {blockType === 'expired' && (
              <button
                type="button"
                onClick={handleChoosePlan}
                className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-primary-600 text-white font-semibold text-sm hover:bg-primary-700 transition-colors shadow-sm"
              >
                <CreditCard className="w-4 h-4" />
                {ctaLabel}
              </button>
            )}
            <button
              type="button"
              onClick={handleSupport}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              <LifeBuoy className="w-4 h-4" />
              Contact Support
            </button>
          </div>

          {/* Billing link — always accessible */}
          <p className="text-center text-xs text-gray-400 mt-5">
            You can always access{' '}
            <button
              type="button"
              onClick={handleChoosePlan}
              className="underline hover:text-gray-600 transition-colors"
            >
              Billing
            </button>{' '}
            and Organization Settings
          </p>
        </div>
      </div>
    </div>
  )
}
