'use client'

import { Check } from 'lucide-react'

export interface PricingCardFeature {
  text: React.ReactNode
  soon?: boolean
}

export interface PricingCardProps {
  /** Card variant: default (neutral), popular (accent border + badge), enterprise (subtle dark accent) */
  variant?: 'default' | 'popular' | 'enterprise'
  /** Optional badge above title (e.g. "Популярный", "Текущий") */
  badge?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Price display (number or formatted string) */
  price: React.ReactNode
  /** Optional suffix after price (e.g. "KGS / мес") */
  priceSuffix?: React.ReactNode
  features: PricingCardFeature[]
  /** "Soon" label for features that have soon: true */
  soonLabel?: string
  /** CTA area: button or link. Rendered at the bottom of the card. */
  children: React.ReactNode
  className?: string
}

/**
 * Shared pricing/plan card. Used on landing (Pricing) and in B2B billing.
 * One place to change layout and styles for both.
 */
export function PricingCard({
  variant = 'default',
  badge,
  title,
  subtitle,
  price,
  priceSuffix,
  features,
  soonLabel = 'скоро',
  children,
  className = '',
}: PricingCardProps) {
  const isPopular = variant === 'popular'
  const isEnterprise = variant === 'enterprise'

  const cardClasses = [
    'relative flex flex-col rounded-2xl border-2 p-6 sm:p-8 min-w-0 transition-shadow',
    isPopular &&
      'border-primary-500 bg-white dark:bg-gray-800/80 shadow-lg shadow-primary-500/10',
    isEnterprise &&
      'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/90 shadow-lg',
    !isPopular &&
      !isEnterprise &&
      'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 shadow-lg hover:shadow-xl',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const titleClasses = `text-lg sm:text-xl font-bold mb-1 ${
    isEnterprise ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'
  }`
  const subtitleClasses = 'text-sm text-gray-500 dark:text-gray-400 mb-3'
  const priceClasses = `text-3xl sm:text-4xl font-bold ${
    isEnterprise ? 'text-gray-900 dark:text-white' : 'text-gray-900 dark:text-white'
  }`
  const priceSuffixClasses = `text-sm ${
    isEnterprise ? 'text-gray-500 dark:text-gray-400' : 'text-gray-600 dark:text-gray-400'
  }`
  const featureTextClasses = `text-sm ${
    isEnterprise ? 'text-gray-600 dark:text-gray-300' : 'text-gray-600 dark:text-gray-300'
  }`
  const checkClasses = `w-4 h-4 flex-shrink-0 mt-0.5 ${
    isEnterprise ? 'text-primary-600' : 'text-primary-500'
  }`

  return (
    <div className={cardClasses}>
      {badge && (
        <div
          className={`absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
            isPopular
              ? 'bg-primary-500 text-white'
              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
          }`}
        >
          {badge}
        </div>
      )}

      <h3 className={titleClasses}>{title}</h3>
      {subtitle && <p className={subtitleClasses}>{subtitle}</p>}

      <div className="flex items-baseline gap-1 mb-6 mt-1 flex-wrap">
        <span className={priceClasses}>{price}</span>
        {priceSuffix != null && <span className={priceSuffixClasses}>{priceSuffix}</span>}
      </div>

      <ul className="space-y-3 flex-1 mb-8">
        {features.map((feature, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <Check className={checkClasses} />
            <span className={`break-words leading-snug ${featureTextClasses}`}>
              {feature.text}
              {feature.soon && (
                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold align-middle bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                  {soonLabel}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{children}</div>
    </div>
  )
}
