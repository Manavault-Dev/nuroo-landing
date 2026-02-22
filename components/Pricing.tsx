'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Check, Sparkles, ArrowRight, UserPlus, CreditCard, ShieldCheck } from 'lucide-react'

const PLANS = [
  {
    id: 'basic',
    price: 1000,
    currency: 'KGS',
    featureKeys: ['basicF1', 'basicF2', 'basicF3', 'basicF4'] as const,
    popular: false,
  },
  {
    id: 'professional',
    price: 3000,
    currency: 'KGS',
    featureKeys: ['proF1', 'proF2', 'proF3', 'proF4', 'proF5'] as const,
    popular: true,
  },
  {
    id: 'enterprise',
    price: 8000,
    currency: 'KGS',
    featureKeys: ['entF1', 'entF2', 'entF3', 'entF4', 'entF5'] as const,
    popular: false,
  },
] as const

export function Pricing() {
  const t = useTranslations('landing.pricing')
  const [isVisible, setIsVisible] = useState(false)

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

        <div
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {PLANS.map((plan) => {
            const planNameKey =
              plan.id === 'basic'
                ? 'basicName'
                : plan.id === 'professional'
                  ? 'professionalName'
                  : 'enterpriseName'
            const isPopular = plan.popular

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl border-2 p-6 sm:p-8 min-w-0 ${
                  isPopular
                    ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 shadow-xl scale-[1.02]'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 shadow-lg hover:shadow-xl'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary-500 text-white text-xs font-semibold">
                    {t('popular')}
                  </div>
                )}
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {t(planNameKey)}
                </h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
                    {plan.price.toLocaleString()}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {plan.currency} / {t('perMonth')}
                  </span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {plan.featureKeys.map((key, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300"
                    >
                      <Check className="w-5 h-5 text-primary-500 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{t(key)}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/b2b/register"
                  className={`inline-flex items-center justify-center gap-2 w-full py-3.5 px-4 rounded-xl font-medium transition-colors ${
                    isPopular
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200'
                  }`}
                >
                  {t('cta')}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            )
          })}
        </div>

        <p
          className={`mt-8 text-center text-sm text-gray-500 dark:text-gray-400 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        >
          {t('afterRegister')}
        </p>

        <div
          className={`mt-12 sm:mt-16 max-w-3xl mx-auto p-6 sm:p-8 rounded-2xl bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 text-center">
            {t('howPaymentTitle')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
                <UserPlus className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">
                1
              </span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('howPaymentStep1')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
                <CreditCard className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">
                2
              </span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('howPaymentStep2')}
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 mb-1">
                3
              </span>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {t('howPaymentStep3')}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('paymentMethodInfo')}
          </p>
        </div>
      </div>
    </section>
  )
}
