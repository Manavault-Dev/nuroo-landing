'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Building2, UserCircle, Users, Video } from 'lucide-react'

const FEATURES = [
  { icon: Building2, titleKey: 'forOrganizations', descKey: 'forOrganizationsDesc' },
  { icon: UserCircle, titleKey: 'forSpecialists', descKey: 'forSpecialistsDesc' },
  { icon: Users, titleKey: 'workWithParents', descKey: 'workWithParentsDesc' },
  { icon: Video, titleKey: 'videoLessons', descKey: 'videoLessonsDesc' },
] as const

export function Platform() {
  const t = useTranslations('landing.platform')

  return (
    <section id="platform-section" className="bg-white dark:bg-gray-900 py-24 sm:py-32">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-teal-600 dark:text-teal-400 text-sm font-semibold uppercase tracking-widest mb-4">
          {t('badge')}
        </p>

        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-20">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-950 dark:text-white max-w-xl leading-tight">
            {t('title')}
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-sm leading-relaxed lg:text-right">
            {t('intro')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-gray-800 border border-gray-100 dark:border-gray-800 rounded-2xl overflow-hidden mb-16">
          {FEATURES.map(({ icon: Icon, titleKey, descKey }) => (
            <div key={titleKey} className="bg-white dark:bg-gray-900 p-8 sm:p-10 group">
              <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center mb-6">
                <Icon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
                {t(titleKey)}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
                {t(descKey)}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/b2b/register"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium transition-colors"
          >
            {t('createAccount')}
          </Link>
          <Link
            href="/b2b/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium transition-colors"
          >
            {t('logInToPlatform')}
          </Link>
        </div>
      </div>
    </section>
  )
}
