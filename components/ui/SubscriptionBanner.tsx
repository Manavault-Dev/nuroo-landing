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
  const t = useTranslations('b2b.subscription')
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
  const translatedMessage =
    bannerType === 'trial_active'
      ? daysRemaining !== null && daysRemaining !== undefined
        ? t('trialActiveWithDays', { days: daysRemaining })
        : t('trialActive')
      : bannerType === 'trial_expiring'
        ? daysRemaining !== null && daysRemaining !== undefined
          ? t('trialExpiringWithDays', { days: daysRemaining })
          : t('trialExpiring')
        : bannerType === 'past_due'
          ? t('pastDue')
          : message
  const translatedCta =
    bannerType === 'past_due' ? t('updateBilling') : ctaLabel ? t('choosePlan') : ctaLabel

  return (
    <div
      role="alert"
      className={`relative flex items-center gap-3 px-4 py-2.5 border-b text-sm ${cfg.bg} ${cfg.border} ${cfg.text}`}
    >
      <Icon className="w-4 h-4 shrink-0" aria-hidden />
      <span className="flex-1 min-w-0">{translatedMessage}</span>
      {daysRemaining !== null && daysRemaining !== undefined && bannerType === 'trial_expiring' && (
        <span className="font-semibold shrink-0">{t('daysLeft', { days: daysRemaining })}</span>
      )}
      <button
        type="button"
        onClick={handleCta}
        className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${cfg.ctaClass}`}
      >
        {translatedCta}
      </button>
      {isDismissible && (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('dismiss')}
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
