'use client'

import { useRouter } from '@/i18n/navigation'
import { AlertTriangle, Clock, CreditCard, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { SubscriptionBannerType } from '@/lib/b2b/subscriptionState'

interface Props {
  bannerType: SubscriptionBannerType
  message: string
  ctaLabel: string
  /** Pass the orgId so we can navigate to the correct billing page */
  orgId?: string | null
  daysRemaining?: number | null
}

const CONFIG: Record<
  Exclude<SubscriptionBannerType, 'none'>,
  {
    icon: typeof Clock
    bg: string
    border: string
    text: string
    ctaClass: string
  }
> = {
  trial_active: {
    icon: Clock,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-800',
    ctaClass: 'bg-blue-700 text-white hover:bg-blue-800',
  },
  trial_expiring: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    ctaClass: 'bg-amber-600 text-white hover:bg-amber-700',
  },
  past_due: {
    icon: CreditCard,
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    ctaClass: 'bg-red-600 text-white hover:bg-red-700',
  },
}

export function SubscriptionBanner({ bannerType, message, ctaLabel, orgId, daysRemaining }: Props) {
  const router = useRouter()
  const t = useTranslations('b2b.pages.billing')
  const [dismissed, setDismissed] = useState(false)

  if (bannerType === 'none' || dismissed) return null

  const cfg = CONFIG[bannerType]
  const Icon = cfg.icon

  const handleCta = () => {
    const href = orgId ? `/b2b/billing?orgId=${orgId}` : '/b2b/billing'
    router.push(href)
  }

  // trial_active banners are dismissible; expiring/past_due are not
  const isDismissible = bannerType === 'trial_active'

  return (
    <div
      role="alert"
      className={`relative grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 border-b px-3 py-2 text-sm sm:px-4 sm:py-2.5 ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0 leading-snug">{message}</span>
      <div className="col-start-2 flex min-w-0 flex-wrap items-center gap-2">
        {daysRemaining !== null &&
          daysRemaining !== undefined &&
          bannerType === 'trial_expiring' && (
            <span className="shrink-0 font-semibold">
              {t('bannerDaysLeft', { days: daysRemaining })}
            </span>
          )}
        <button
          type="button"
          onClick={handleCta}
          className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${cfg.ctaClass}`}
        >
          {ctaLabel}
        </button>
        {isDismissible && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 rounded-md p-1 opacity-60 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
