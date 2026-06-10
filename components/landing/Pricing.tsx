'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Sparkles, ArrowRight, Check } from 'lucide-react'
import { PLAN_FEATURE_KEYS } from '@/lib/pricing/planFeatureKeys'
import {
  PLAN_PRICES,
  getMonthlyAnnualTotal,
  getYearlySavings,
  getMonthlyEquivalent,
  type BillingPeriod,
} from '@/lib/pricing/pricingConfig'

const PLAN_META = [
  {
    id: 'starter' as const,
    titleKey: 'starterName',
    subtitleKey: 'starterSubtitle',
    priceFrom: false,
    popular: false,
    ctaKey: 'ctaStartTrial' as const,
    ctaHref: '/b2b/register',
  },
  {
    id: 'growth' as const,
    titleKey: 'growthName',
    subtitleKey: 'growthSubtitle',
    priceFrom: false,
    popular: true,
    ctaKey: 'ctaStartTrial' as const,
    ctaHref: '/b2b/register',
  },
  {
    id: 'enterprise' as const,
    titleKey: 'enterpriseName',
    subtitleKey: 'enterpriseSubtitle',
    priceFrom: true,
    popular: false,
    ctaKey: 'ctaContactUs' as const,
    ctaHref: 'mailto:tilek.dzenisev@gmail.com',
  },
] as const

export function Pricing() {
  const t = useTranslations('landing.pricing')
  const locale = useLocale()
  const [isVisible, setIsVisible] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')

  const numberLocale = locale === 'en' ? 'en-US' : locale === 'ru' ? 'ru-RU' : 'ky-KG'
  const formatPrice = (n: number) => n.toLocaleString(numberLocale)

  type DisplayId = 'starter' | 'growth' | 'enterprise'
  const toPriceId = (planId: DisplayId): 'starter' | 'growth' | 'enterprise' => planId

  const getPlanPriceForDisplay = (planId: DisplayId) => {
    const priceId = toPriceId(planId)
    const found = PLAN_PRICES.find((p) => p.id === priceId)
    if (!found) return 0
    return billingPeriod === 'yearly' ? found.yearlyPrice : found.monthlyPrice
  }

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

          {/* Billing period toggle */}
          <div
            className={`mt-6 flex flex-col items-center gap-2 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="inline-flex items-center gap-0 rounded-full border border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setBillingPeriod('monthly')}
                className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'monthly'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t('billingMonthly')}
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod('yearly')}
                className={`relative px-5 py-2 rounded-full text-sm font-medium transition-all ${
                  billingPeriod === 'yearly'
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t('billingYearly')}
                <span className="absolute -top-2.5 -right-2 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
                  🔥 {t('savePercent')}
                </span>
              </button>
            </div>
            {billingPeriod === 'yearly' && (
              <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                {t('annualBillingNote')}
              </p>
            )}
          </div>
        </div>

        {/* 3-column plan grid */}
        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {PLAN_META.map((plan) => {
            const featureKeys = PLAN_FEATURE_KEYS[plan.id]
            const isPro = plan.popular
            const isEnt = plan.id === 'enterprise'

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border ${
                  isPro
                    ? 'border-primary-400 bg-gradient-to-br from-primary-600 to-primary-800 text-white shadow-2xl shadow-primary-500/25 scale-[1.03]'
                    : isEnt
                      ? 'border-gray-800 bg-gray-900 dark:bg-gray-950 text-white shadow-xl'
                      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                }`}
              >
                {/* Popular badge */}
                {isPro && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 bg-white text-primary-700 text-xs font-bold px-4 py-1.5 rounded-full shadow-md">
                      <Sparkles className="w-3 h-3" />
                      {t('popular')}
                    </span>
                  </div>
                )}

                <div className="p-6 sm:p-8 flex flex-col h-full">
                  {/* Plan name & subtitle */}
                  <div className="mb-6">
                    <h3
                      className={`text-xl font-bold mb-1 ${isPro ? 'text-white' : isEnt ? 'text-white' : 'text-gray-900 dark:text-white'}`}
                    >
                      {t(plan.titleKey)}
                    </h3>
                    <p
                      className={`text-sm leading-5 ${isPro ? 'text-primary-100/90' : isEnt ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}
                    >
                      {t(plan.subtitleKey)}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {/* Main price row */}
                    <div className="flex items-end gap-1.5 flex-wrap">
                      {plan.priceFrom && (
                        <span
                          className={`pb-1 text-sm font-medium ${isPro ? 'text-primary-100/80' : isEnt ? 'text-gray-400' : 'text-gray-400'}`}
                        >
                          {t('from')}
                        </span>
                      )}
                      <span
                        className={`pb-1 text-sm font-medium ${isPro ? 'text-primary-100/80' : isEnt ? 'text-gray-400' : 'text-gray-400'}`}
                      >
                        $
                      </span>
                      <span
                        className={`text-4xl font-bold tracking-tight ${isPro ? 'text-white' : isEnt ? 'text-white' : 'text-gray-900 dark:text-white'}`}
                      >
                        {formatPrice(getPlanPriceForDisplay(plan.id))}
                      </span>
                      <span
                        className={`pb-1 text-sm font-medium ${isPro ? 'text-primary-100/80' : isEnt ? 'text-gray-400' : 'text-gray-400 dark:text-gray-400'}`}
                      >
                        / {billingPeriod === 'yearly' ? t('perYear') : t('perMonth')}
                      </span>
                    </div>

                    {/* Yearly: savings breakdown + monthly equivalent */}
                    {billingPeriod === 'yearly' && (
                      <div className="mt-2 space-y-1">
                        {/* Crossed-out monthly total + save badge */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm line-through ${isPro ? 'text-primary-200/60' : isEnt ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}
                          >
                            ${formatPrice(getMonthlyAnnualTotal(toPriceId(plan.id)))}
                          </span>
                          <span
                            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              isPro
                                ? 'bg-white/15 text-white'
                                : isEnt
                                  ? 'bg-green-900/40 text-green-400'
                                  : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            }`}
                          >
                            {t('saveLabel')} ${formatPrice(getYearlySavings(toPriceId(plan.id)))}
                          </span>
                        </div>
                        {/* Monthly equivalent */}
                        <p
                          className={`text-xs ${isPro ? 'text-primary-100/70' : isEnt ? 'text-gray-500' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                          ≈ ${formatPrice(getMonthlyEquivalent(toPriceId(plan.id)))} /{' '}
                          {t('perMonth')} · {t('billedAnnually')}
                        </p>
                      </div>
                    )}

                    {/* Monthly: subtle note */}
                    {billingPeriod === 'monthly' && (
                      <p
                        className={`mt-1 text-xs ${isPro ? 'text-primary-100/60' : isEnt ? 'text-gray-600' : 'text-gray-400 dark:text-gray-500'}`}
                      >
                        {t('billedMonthlyNote')}
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {featureKeys.map((key) => (
                      <li key={key} className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                            isPro
                              ? 'bg-white/20'
                              : isEnt
                                ? 'bg-white/10'
                                : 'bg-primary-100 dark:bg-primary-900/40'
                          }`}
                        >
                          <Check
                            className={`w-2.5 h-2.5 ${isPro ? 'text-white' : isEnt ? 'text-gray-300' : 'text-primary-600 dark:text-primary-400'}`}
                          />
                        </div>
                        <span
                          className={`text-sm leading-5 ${isPro ? 'text-primary-50/95' : isEnt ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}
                        >
                          {t(key as Parameters<typeof t>[0])}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    href={plan.ctaHref}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-colors ${
                      isPro
                        ? 'bg-white text-primary-700 hover:bg-primary-50 shadow-lg shadow-primary-950/20'
                        : isEnt
                          ? 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                          : 'bg-primary-600 text-white hover:bg-primary-700'
                    }`}
                  >
                    {t(plan.ctaKey)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* Trial + footer notes */}
        <div
          className={`mt-10 text-center space-y-2 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          <p className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-4 py-2 rounded-full">
            <span>🎁</span>
            {t('trialNote')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('afterRegister')}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">{t('paymentMethodInfo')}</p>
        </div>
      </div>
    </section>
  )
}
