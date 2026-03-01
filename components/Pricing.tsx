'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Sparkles, ArrowRight } from 'lucide-react'
import { PricingCard } from '@/components/ui/PricingCard'
import { PLAN_FEATURE_KEYS } from '@/lib/pricing/planFeatureKeys'

const PLAN_META = [
  { id: 'starter',    titleKey: 'starterName',    price: 1500,  variant: 'default',    popular: false },
  { id: 'growth',     titleKey: 'growthName',     price: 3500,  variant: 'popular',    popular: true  },
  { id: 'enterprise', titleKey: 'enterpriseName', price: 10000, variant: 'enterprise', popular: false },
] as const

export function Pricing() {
  const t = useTranslations('landing.pricing')
  const locale = useLocale()
  const [isVisible, setIsVisible] = useState(false)

  const numberLocale = locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : 'ky-KG'
  const formatPrice = (n: number) => n.toLocaleString(numberLocale)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.1 }
    )
    const el = document.getElementById('pricing')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="pricing"
      className="section-padding bg-gradient-to-b from-primary-50/30 to-white dark:from-primary-950/20 dark:to-gray-900 min-w-0"
    >
      <div className="container-custom min-w-0">
        {/* Header */}
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-14">
          <div
            className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 break-words transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('title')}
          </h2>
          <p
            className={`text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto break-words transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('subtitle')}
          </p>
        </div>

        {/* Plans grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {PLAN_META.map((plan) => (
            <PricingCard
              key={plan.id}
              variant={plan.variant}
              badge={plan.popular ? t('popular') : undefined}
              title={t(plan.titleKey)}
              subtitle={plan.id === 'enterprise' ? t('enterpriseSubtitle') : undefined}
              price={formatPrice(plan.price)}
              priceSuffix={`KGS / ${t('perMonth')}`}
              features={PLAN_FEATURE_KEYS[plan.id].map((key) => ({ text: t(key) }))}
              soonLabel={t('soon')}
            >
              <Link
                href="/b2b/register"
                className={`inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-medium transition-colors ${
                  plan.popular
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'
                }`}
              >
                {t('cta')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </PricingCard>
          ))}
        </div>

        {/* Footer notes */}
        <p
          className={`mt-8 text-center text-sm text-gray-500 dark:text-gray-400 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {t('afterRegister')}
        </p>
        <p
          className={`mt-2 text-center text-xs text-gray-400 dark:text-gray-500 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {t('paymentMethodInfo')}
        </p>
      </div>
    </section>
  )
}
