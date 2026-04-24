'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Sparkles, ArrowRight, Users, Bot, Palette, BarChart3, CheckCircle2 } from 'lucide-react'

const PLAN_META = [
  {
    id: 'enterprise',
    titleKey: 'enterpriseName',
    price: 4500,
    variant: 'popular',
    popular: true,
  },
] as const

const VALUE_PILLARS = [
  { key: 'pillarWorkspace', icon: Users },
  { key: 'pillarAssistant', icon: Bot },
  { key: 'pillarBranding', icon: Palette },
  { key: 'pillarAnalytics', icon: BarChart3 },
] as const

const INCLUDED_KEYS = [
  'includedUnlimited',
  'includedParents',
  'includedTasks',
  'includedAttendance',
  'includedFinance',
  'includedLaunch',
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

        {/* One clear B2B offer instead of a long feature list */}
        <div
          className={`mx-auto max-w-5xl overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-2xl shadow-primary-500/10 transition-all duration-700 delay-300 dark:border-primary-900/50 dark:bg-gray-800/90 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {PLAN_META.map((plan) => (
            <div key={plan.id} className="grid gap-0 lg:grid-cols-[0.95fr_1.25fr]">
              <div className="flex flex-col justify-between bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white sm:p-8">
                <div>
                  <div className="mb-5 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary-50">
                    {t('onePlanBadge')}
                  </div>
                  <h3 className="text-2xl font-bold sm:text-3xl">{t(plan.titleKey)}</h3>
                  <p className="mt-3 text-sm leading-6 text-primary-50/90">
                    {t('enterpriseSubtitle')}
                  </p>

                  <div className="mt-7 flex items-end gap-2">
                    <span className="text-4xl font-bold tracking-tight sm:text-5xl">
                      {formatPrice(plan.price)}
                    </span>
                    <span className="pb-1 text-sm font-medium text-primary-50/80">
                      KGS / {t('perMonth')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-primary-50/70">{t('priceNote')}</p>
                </div>

                <Link
                  href="/b2b/register"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-sm font-semibold text-primary-700 shadow-lg shadow-primary-950/20 transition-colors hover:bg-primary-50"
                >
                  {t('cta')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-2">
                  {VALUE_PILLARS.map((pillar) => {
                    const Icon = pillar.icon

                    return (
                      <div
                        key={pillar.key}
                        className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-gray-900/40"
                      >
                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/60 dark:text-primary-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                          {t(`${pillar.key}Title`)}
                        </h4>
                        <p className="mt-1 text-sm leading-5 text-gray-600 dark:text-gray-300">
                          {t(`${pillar.key}Text`)}
                        </p>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                    {t('includedTitle')}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {INCLUDED_KEYS.map((key) => (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-600" />
                        <span>{t(key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
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
