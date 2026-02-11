'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Building2, UserCircle, Users, Video, ArrowRight, Sparkles } from 'lucide-react'

export function Platform() {
  const t = useTranslations('landing.platform')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.1 }
    )
    const el = document.getElementById('platform-section')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const benefits = [
    {
      icon: <Building2 className="w-7 h-7 text-primary-500" />,
      titleKey: 'forOrganizations',
      descKey: 'forOrganizationsDesc',
    },
    {
      icon: <UserCircle className="w-7 h-7 text-secondary-500" />,
      titleKey: 'forSpecialists',
      descKey: 'forSpecialistsDesc',
    },
    {
      icon: <Users className="w-7 h-7 text-accent-500" />,
      titleKey: 'workWithParents',
      descKey: 'workWithParentsDesc',
    },
    {
      icon: <Video className="w-7 h-7 text-primary-500" />,
      titleKey: 'videoLessons',
      descKey: 'videoLessonsDesc',
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
            className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-xs sm:text-sm font-medium mb-4 sm:mb-6 md:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6 transition-all duration-700 delay-100 px-1 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('title')}
          </h2>
          <p
            className={`text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-3 sm:mb-4 transition-all duration-700 delay-200 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('intro')}
          </p>
          <p
            className={`text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 transition-all duration-700 delay-300 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('intro2')}
          </p>
        </div>

        <div
          className={`grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-10 sm:mb-14 md:mb-20 transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          {benefits.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg hover:shadow-xl transition-all duration-300 card-hover"
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
          className={`flex flex-col sm:flex-row items-center justify-center gap-4 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
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
