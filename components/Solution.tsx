'use client'

import { motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { Building2, UserCircle, Users, Heart } from 'lucide-react'

const vFadeUp = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
}
const vScale = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.55, ease: 'easeOut' as const } },
}
const vStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
}

type RoleCardProps = {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  badge: string
  badgeColor: string
  title: string
  subtitle: string
  features: { title: string; desc: string }[]
  accent: string
}

function RoleCard({
  icon: Icon,
  iconBg,
  iconColor,
  badge,
  badgeColor,
  title,
  subtitle,
  features,
  accent,
}: RoleCardProps) {
  return (
    <motion.div
      variants={vFadeUp}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="group flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 p-7 shadow-sm hover:shadow-xl transition-colors duration-300"
    >
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center mb-5`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>

      <span className={`text-xs font-semibold uppercase tracking-widest ${badgeColor} mb-3`}>
        {badge}
      </span>

      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 leading-snug">{title}</h3>

      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed mb-6">{subtitle}</p>

      <ul className="space-y-3 mt-auto">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-3">
            <div className={`w-1.5 h-1.5 rounded-full ${accent} mt-1.5 flex-shrink-0`} />
            <div>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {f.title}
              </span>
              {f.desc && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}

function StatBadge({ number, label }: { number: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-3xl md:text-4xl font-bold text-primary-600 dark:text-primary-400">
        {number}
      </span>
      <span className="text-sm text-gray-500 dark:text-gray-400 mt-1 text-center max-w-[120px]">
        {label}
      </span>
    </div>
  )
}

export function Solution() {
  const tOrgs = useTranslations('landing.forOrgs')
  const tSpec = useTranslations('landing.forSpecialists')
  const tPar = useTranslations('landing.forParents')
  const tSol = useTranslations('landing.solution')

  const stats = [
    { number: '1500+', label: tSol('parentSatisfaction') },
    { number: '3x', label: tSol('fasterProgress') },
    { number: '85%', label: tSol('costReduction') },
    { number: '24/7', label: tSol('availableSupport') },
  ]

  return (
    <section
      id="solution-section"
      className="section-padding bg-gray-50 dark:bg-gray-900/50 min-w-0"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Section header */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-80px' }}
          variants={vFadeUp}
          className="text-center mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-sm font-medium mb-5">
            <Users className="w-4 h-4" />
            <span>{tSol('sectionBadge')}</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 leading-tight">
            {tSol('sectionTitle')}
            <br />
            <span className="gradient-text">{tSol('sectionTitleHighlight')}</span>
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
            {tSol('sectionIntro')}
          </p>
        </motion.div>

        {/* Three role cards — staggered entrance */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={vStagger}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16"
        >
          <RoleCard
            icon={Building2}
            iconBg="bg-primary-50 dark:bg-primary-950/60"
            iconColor="text-primary-600 dark:text-primary-400"
            badge={tOrgs('badge')}
            badgeColor="text-primary-600 dark:text-primary-400"
            title={tOrgs('title')}
            subtitle={tOrgs('subtitle')}
            features={[
              { title: tOrgs('f1Title'), desc: tOrgs('f1Desc') },
              { title: tOrgs('f2Title'), desc: tOrgs('f2Desc') },
              { title: tOrgs('f3Title'), desc: tOrgs('f3Desc') },
            ]}
            accent="bg-primary-500"
          />
          <RoleCard
            icon={UserCircle}
            iconBg="bg-cyan-50 dark:bg-cyan-950/60"
            iconColor="text-cyan-600 dark:text-cyan-400"
            badge={tSpec('badge')}
            badgeColor="text-cyan-600 dark:text-cyan-400"
            title={tSpec('title')}
            subtitle={tSpec('subtitle')}
            features={[
              { title: tSpec('f1Title'), desc: tSpec('f1Desc') },
              { title: tSpec('f2Title'), desc: tSpec('f2Desc') },
              { title: tSpec('f3Title'), desc: tSpec('f3Desc') },
            ]}
            accent="bg-cyan-500"
          />
          <RoleCard
            icon={Heart}
            iconBg="bg-emerald-50 dark:bg-emerald-950/60"
            iconColor="text-emerald-600 dark:text-emerald-400"
            badge={tPar('badge')}
            badgeColor="text-emerald-600 dark:text-emerald-400"
            title={tPar('title')}
            subtitle={tPar('subtitle')}
            features={[
              { title: tPar('f1Title'), desc: tPar('f1Desc') },
              { title: tPar('f2Title'), desc: tPar('f2Desc') },
              { title: tPar('f3Title'), desc: tPar('f3Desc') },
            ]}
            accent="bg-emerald-500"
          />
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={vScale}
          className="bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/40 dark:to-secondary-900/30 rounded-2xl p-8 border border-primary-200 dark:border-primary-800/30"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s, i) => (
              <StatBadge key={i} number={s.number} label={s.label} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
