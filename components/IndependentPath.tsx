'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Download, Sparkles, TrendingUp, UserPlus, ArrowRight, UserCircle } from 'lucide-react'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'
import { Link } from '@/i18n/navigation'

const vFadeLeft = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}
const vFadeRight = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
}
const vStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
}
const vFadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
}

const STEP_ICONS = [Download, Sparkles, TrendingUp, UserPlus] as const

export function IndependentPath() {
  const t = useTranslations('landing.startAlone')

  const steps = [
    {
      icon: STEP_ICONS[0],
      title: t('step1Title'),
      desc: t('step1Desc'),
      color: 'text-primary-600 dark:text-primary-400',
      bg: 'bg-primary-50 dark:bg-primary-950/60',
      connector: 'bg-primary-200 dark:bg-primary-800',
    },
    {
      icon: STEP_ICONS[1],
      title: t('step2Title'),
      desc: t('step2Desc'),
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/60',
      connector: 'bg-violet-200 dark:bg-violet-800',
    },
    {
      icon: STEP_ICONS[2],
      title: t('step3Title'),
      desc: t('step3Desc'),
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/60',
      connector: 'bg-emerald-200 dark:bg-emerald-800',
    },
    {
      icon: STEP_ICONS[3],
      title: t('step4Title'),
      desc: t('step4Desc'),
      color: 'text-cyan-600 dark:text-cyan-400',
      bg: 'bg-cyan-50 dark:bg-cyan-950/60',
      connector: null,
    },
  ] as const

  return (
    <section className="section-padding bg-white dark:bg-gray-900 min-w-0">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left: Steps */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={vFadeLeft}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-5">
              {t('badge')}
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
              {t('title')}
            </h2>

            <p className="text-gray-500 dark:text-gray-400 mb-10 leading-relaxed text-lg">
              {t('subtitle')}
            </p>

            {/* Step flow — staggered */}
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: '-60px' }}
              variants={vStagger}
              className="space-y-0"
            >
              {steps.map((step, i) => {
                const Icon = step.icon
                return (
                  <motion.div key={i} variants={vFadeUp} className="flex gap-4">
                    {/* Icon + connector */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center z-10`}
                      >
                        <Icon className={`w-5 h-5 ${step.color}`} />
                      </div>
                      {step.connector && <div className={`w-0.5 h-10 ${step.connector} mt-1`} />}
                    </div>

                    {/* Content */}
                    <div
                      className={`pb-0 ${step.connector ? 'mb-1' : ''}`}
                      style={{ paddingTop: '8px', paddingBottom: step.connector ? '16px' : '0' }}
                    >
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {step.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                        {step.desc}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* App download CTA */}
            <div className="mt-8 flex flex-wrap gap-3">
              <AppStoreButton />
              <GooglePlayButton />
            </div>
          </motion.div>

          {/* Right: Independent specialist callout + visual */}
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            variants={vFadeRight}
            className="flex flex-col gap-6"
          >
            {/* Independent parent highlight */}
            <div className="bg-gradient-to-br from-primary-50 to-emerald-50 dark:from-primary-950/40 dark:to-emerald-950/30 border border-primary-100 dark:border-primary-800/30 rounded-2xl p-8">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/60 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400 mb-1">
                    {t('badge')}
                  </p>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                    {t('step2Title')}
                  </h3>
                </div>
              </div>

              <div className="space-y-3">
                {[t('step1Title'), t('step2Title'), t('step3Title'), t('step4Title')].map(
                  (item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary-200 dark:bg-primary-800 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-primary-700 dark:text-primary-300">
                          {i + 1}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item}</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Independent specialist card */}
            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/40 flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                  {t('forSpecTitle')}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3">
                  {t('forSpecDesc')}
                </p>
                <Link
                  href="/b2b/register"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                >
                  {t('independentSpecLink')}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
