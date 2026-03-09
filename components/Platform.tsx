'use client'

import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Building2, UserCircle, Users, Video, ArrowRight, Sparkles } from 'lucide-react'

export function Platform() {
  const t = useTranslations('landing.platform')

  const benefits = [
    {
      icon: <Building2 className="w-7 h-7 text-primary-500" />,
      titleKey: 'forOrganizations',
      descKey: 'forOrganizationsDesc',
      delay: 'sr-delay-100',
    },
    {
      icon: <UserCircle className="w-7 h-7 text-secondary-500" />,
      titleKey: 'forSpecialists',
      descKey: 'forSpecialistsDesc',
      delay: 'sr-delay-200',
    },
    {
      icon: <Users className="w-7 h-7 text-accent-500" />,
      titleKey: 'workWithParents',
      descKey: 'workWithParentsDesc',
      delay: 'sr-delay-300',
    },
    {
      icon: <Video className="w-7 h-7 text-primary-500" />,
      titleKey: 'videoLessons',
      descKey: 'videoLessonsDesc',
      delay: 'sr-delay-400',
    },
  ] as const

  return (
    <section
      id="platform-section"
      className="section-padding bg-gradient-to-b from-white to-primary-50/30 dark:from-gray-900 dark:to-primary-950/20 min-w-0"
    >
      <div className="container-custom min-w-0">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-14 md:mb-20">
          <div
            data-sr
            className="sr-up sr-duration-700 sr-delay-0 inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6 md:mb-8"
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            data-sr
            className="sr-up sr-duration-700 sr-delay-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6 px-1 break-words"
          >
            {t('title')}
          </h2>
          <p
            data-sr
            className={`sr-up sr-duration-700 sr-delay-200 text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 ${t('intro2') ? 'mb-3 sm:mb-4' : ''} break-words`}
          >
            {t('intro')}
          </p>
          {t('intro2') ? (
            <p
              data-sr
              className="sr-up sr-duration-700 sr-delay-300 text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 break-words"
            >
              {t('intro2')}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-10 sm:mb-14 md:mb-20">
          {benefits.map((item, index) => (
            <div
              key={index}
              data-sr
              className={`sr-up sr-duration-700 ${item.delay} glow-card bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg`}
            >
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                    {t(item.titleKey)}
                  </h3>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                    {t(item.descKey)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          data-sr
          className="sr-up sr-duration-700 sr-delay-300 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            href="/b2b/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl transition-colors shadow-sm"
          >
            {t('logInToPlatform')}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/b2b/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors shadow-lg"
          >
            {t('createAccount')}
          </Link>
        </div>
      </div>
    </section>
  )
}
