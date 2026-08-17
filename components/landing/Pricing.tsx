'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Check, Shield, RotateCcw, TrendingUp, ArrowRight } from 'lucide-react'
import { Analytics } from '@/lib/analytics'

const NUROO_FEATURE_KEYS = ['nF1', 'nF2', 'nF3', 'nF4', 'nF5', 'nF6', 'nF7', 'nF8', 'nF9'] as const

const BUSINESS_FEATURE_KEYS = [
  'bF1',
  'bF2',
  'bF3',
  'bF4',
  'bF5',
  'bF6',
  'bF7',
  'bF8',
  'bF9',
  'bF10',
] as const

export function Pricing() {
  const t = useTranslations('landing.pricing')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.05 }
    )
    const el = document.getElementById('pricing')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section id="pricing" className="py-20 lg:py-28 bg-white dark:bg-gray-900 min-w-0">
      <style>{`
        @keyframes nuri-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        .nuri-float { animation: nuri-float 3.8s ease-in-out infinite; }
      `}</style>

      <div className="container-custom min-w-0">
        {/* ── HEADER: текст слева + Нури справа (lg+) ── */}
        <div
          className={`max-w-4xl mx-auto mb-14 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-6">
            {/* Текст */}
            <div className="flex-1 text-center lg:text-left">
              <span className="inline-block text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-4">
                {t('badge')}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
                {t('title')}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed max-w-xl">
                {t('subtitle')}
              </p>
            </div>

            {/* Нури с речевым пузырём — только lg+ */}
            <div className="hidden lg:flex flex-col items-center flex-shrink-0 w-52 pb-2">
              {/* Речевой пузырь */}
              <div className="relative bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-700 rounded-2xl px-4 py-3 mb-3 text-sm font-medium text-teal-700 dark:text-teal-300 text-center leading-snug shadow-sm">
                {t('mascotSpeech')}
                {/* Стрелочка вниз */}
                <span
                  className="absolute -bottom-[9px] left-1/2 -translate-x-1/2 block w-0 h-0"
                  style={{
                    borderLeft: '8px solid transparent',
                    borderRight: '8px solid transparent',
                    borderTop: '9px solid',
                    borderTopColor: 'rgb(204 251 241)', // teal-100 equivalent
                  }}
                />
              </div>
              {/* Маскот */}
              <img
                src="/mascot-3.svg"
                alt="Нури — ваш помощник"
                width={200}
                height={280}
                className="nuri-float drop-shadow-sm"
                style={{ transform: 'scaleX(-1)' }}
              />
            </div>
          </div>
        </div>

        {/* ── 2 КАРТОЧКИ ТАРИФОВ ── */}
        <div
          className={`grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-6 transition-all duration-700 delay-150 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          {/* Nuroo */}
          <div className="flex flex-col rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 shadow-sm">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {t('nurooName')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('nurooSubtitle')}</p>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {t('nurooValueProp')}
            </p>

            {/* Цена */}
            <div className="mb-7">
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-3">
                {t('trialBadge')}
              </div>
              <div className="flex items-end gap-1">
                <span className="text-sm text-gray-400 dark:text-gray-500 pb-1.5">$</span>
                <span className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                  15
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500 pb-1.5 ml-1">
                  / {t('perMonth')}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {t('afterTrialCaption')}
              </p>
            </div>

            {/* Фичи */}
            <ul className="space-y-2.5 mb-8 flex-1">
              {NUROO_FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t(key)}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/b2b/register"
              onClick={() => Analytics.pricingNurooCta()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
            >
              {t('nurooCta')}
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </Link>
            <p className="mt-2.5 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('microCopy')}
            </p>
          </div>

          {/* Nuroo Business */}
          <div className="flex flex-col rounded-2xl border border-teal-200 dark:border-teal-700/50 bg-teal-50/40 dark:bg-teal-950/15 p-8 shadow-sm">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                {t('businessName')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('businessSubtitle')}</p>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {t('businessValueProp')}
            </p>

            {/* Цена */}
            <div className="mb-7">
              <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-300 text-xs font-semibold mb-3">
                {t('trialBadge')}
              </div>
              <div className="flex items-end gap-1">
                <span className="text-sm text-gray-400 dark:text-gray-500 pb-1.5">$</span>
                <span className="text-5xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">
                  50
                </span>
                <span className="text-sm text-gray-400 dark:text-gray-500 pb-1.5 ml-1">
                  / {t('perMonth')}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                {t('afterTrialCaption')}
              </p>
            </div>

            {/* Фичи с вводной строкой */}
            <ul className="space-y-2.5 mb-8 flex-1">
              <li className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide pb-1">
                {t('businessIntro')}
              </li>
              {BUSINESS_FEATURE_KEYS.map((key) => (
                <li key={key} className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-teal-600 dark:text-teal-400" />
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{t(key)}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/b2b/register"
              onClick={() => Analytics.pricingBusinessCta()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
            >
              {t('businessCta')}
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </Link>
            <p className="mt-2.5 text-center text-xs text-gray-400 dark:text-gray-500">
              {t('microCopy')}
            </p>
          </div>
        </div>

        {/* ── ENTERPRISE STRIP ── */}
        <div
          className={`max-w-4xl mx-auto mb-14 transition-all duration-700 delay-300 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-6 py-5">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('enterpriseTitle')}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {t('enterpriseText')}
              </p>
            </div>
            <a
              href="mailto:tilek.dzenisev@gmail.com"
              onClick={() => Analytics.pricingEnterpriseCta()}
              className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors whitespace-nowrap"
            >
              {t('enterpriseCta')}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* ── TRUST BLOCK ── */}
        <div
          className={`max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center transition-all duration-700 delay-500 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
          }`}
        >
          <div>
            <div className="flex items-center justify-center mb-2.5">
              <Shield className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('trust1Title')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {t('trust1Text')}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2.5">
              <RotateCcw className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('trust2Title')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {t('trust2Text')}
            </p>
          </div>
          <div>
            <div className="flex items-center justify-center mb-2.5">
              <TrendingUp className="w-5 h-5 text-teal-500" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('trust3Title')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
              {t('trust3Text')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
