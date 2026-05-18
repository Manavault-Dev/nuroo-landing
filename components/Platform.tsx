'use client'

import { motion } from 'framer-motion'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Bot, Palette, BarChart3, CheckCircle2, ArrowRight, Smartphone, Zap } from 'lucide-react'

const vFadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}
const vFadeLeft = {
  hidden: { opacity: 0, x: -32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}
const vFadeRight = {
  hidden: { opacity: 0, x: 32 },
  show: { opacity: 1, x: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}
const vStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
}

export function Platform() {
  const tPlatform = useTranslations('landing.platform')
  const tAI = useTranslations('landing.aiCopilot')
  const tParentAI = useTranslations('landing.parentAI')
  const tBrand = useTranslations('landing.branding')
  const tReports = useTranslations('landing.reports')

  return (
    <section id="platform-section" className="section-padding bg-gray-50 dark:bg-gray-950 min-w-0">
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={vFadeUp}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-sm font-medium mb-5">
            <Zap className="w-4 h-4" />
            <span>{tPlatform('sectionBadge')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {tPlatform('sectionTitle')}{' '}
            <span className="gradient-text">{tPlatform('sectionTitleHighlight')}</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            {tPlatform('sectionIntro')}
          </p>
        </motion.div>

        {/* AI section: two columns side by side */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={vStagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
        >
          {/* AI for Centers & Specialists */}
          <motion.div
            variants={vFadeLeft}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-violet-100 dark:border-violet-900/40 p-8 flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-100/50 dark:bg-violet-900/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />

            <div className="w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/60 flex items-center justify-center mb-5">
              <Bot className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>

            <span className="text-xs font-semibold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-3">
              {tAI('badge')}
            </span>

            <h3 className="text-xl font-bold text-gray-950 dark:text-white mb-3 leading-snug">
              {tAI('title')}
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
              {tAI('subtitle')}
            </p>

            <ul className="space-y-3 mt-auto">
              {(['f1', 'f2', 'f3', 'f4'] as const).map((k) => (
                <li key={k} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{tAI(k)}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* AI for Parents */}
          <motion.div
            variants={vFadeRight}
            whileHover={{ y: -4, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 p-8 flex flex-col relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-100/50 dark:bg-emerald-900/20 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl pointer-events-none" />

            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center mb-5">
              <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>

            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">
              {tParentAI('badge')}
            </span>

            <h3 className="text-xl font-bold text-gray-950 dark:text-white mb-3 leading-snug">
              {tParentAI('title')}
            </h3>

            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-7">
              {tParentAI('subtitle')}
            </p>

            <ul className="space-y-3 mt-auto">
              {(['f1', 'f2', 'f3', 'f4'] as const).map((k) => (
                <li key={k} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{tParentAI(k)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Branding + Reports: two smaller cards */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={vStagger}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12"
        >
          <motion.div
            variants={vFadeLeft}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-7 flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center mb-5">
              <Palette className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-3">
              {tBrand('badge')}
            </span>
            <h3 className="text-lg font-bold text-gray-950 dark:text-white mb-2 leading-snug">
              {tBrand('title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              {tBrand('subtitle')}
            </p>
            <ul className="space-y-2 mt-auto">
              {(['f1', 'f2', 'f3'] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{tBrand(k)}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            variants={vFadeRight}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-7 flex flex-col"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center mb-5">
              <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400 mb-3">
              {tReports('badge')}
            </span>
            <h3 className="text-lg font-bold text-gray-950 dark:text-white mb-2 leading-snug">
              {tReports('title')}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-5">
              {tReports('subtitle')}
            </p>
            <ul className="space-y-2 mt-auto">
              {(['f1', 'f2', 'f3', 'f4'] as const).map((k) => (
                <li key={k} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600 dark:text-gray-300">{tReports(k)}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </motion.div>

        {/* Bottom CTA */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={vFadeUp}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/b2b/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white text-sm font-semibold transition-all duration-200 shadow-lg shadow-primary-500/25"
          >
            {tPlatform('ctaPrimary')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/b2b/login"
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            {tPlatform('ctaSecondary')}
          </Link>
        </motion.div>
      </div>
    </section>
  )
}
