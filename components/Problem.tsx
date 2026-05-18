'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, DollarSign, Clock, MapPin, Users, Heart } from 'lucide-react'

export function Problem() {
  const t = useTranslations('landing.problem')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.1 }
    )
    const el = document.getElementById('problem-section')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const problems = [
    {
      icon: <Users className="w-8 h-8 text-red-500" />,
      titleKey: 'limitedAccess' as const,
      descKey: 'limitedAccessDesc' as const,
      stat: '75%',
    },
    {
      icon: <DollarSign className="w-8 h-8 text-red-500" />,
      titleKey: 'highCosts' as const,
      descKey: 'highCostsDesc' as const,
      stat: '$60k/year',
    },
    {
      icon: <MapPin className="w-8 h-8 text-red-500" />,
      titleKey: 'longWait' as const,
      descKey: 'longWaitDesc' as const,
      stat: '12+ months',
    },
    {
      icon: <Clock className="w-8 h-8 text-red-500" />,
      titleKey: 'parentOverload' as const,
      descKey: 'parentOverloadDesc' as const,
      stat: '70% stressed',
    },
  ]

  return (
    <section id="problem-section" className="section-padding bg-gray-50 dark:bg-gray-800 min-w-0">
      <div className="container-custom min-w-0">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-16 min-w-0 px-2 sm:px-0">
          <div
            className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 transition-all duration-700 delay-200 break-words overflow-visible ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('title')}
            <br className="sm:hidden" />
            <span className="text-red-500 mt-1 sm:mt-0 sm:ml-2 md:ml-3 inline-block">
              {t('titleHighlight')}
            </span>
          </h2>
          <p
            className={`text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12 transition-all duration-700 delay-300 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('intro')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 min-w-0">
          {problems.map((item, index) => (
            <div
              key={index}
              className={`bg-white dark:bg-gray-900 p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg hover:shadow-xl transition-all duration-500 card-hover min-w-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <div className="flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-red-50 dark:bg-red-900 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 mx-auto">
                {item.icon}
              </div>
              <div className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-red-500 mb-1 sm:mb-2">
                  {item.stat}
                </div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 dark:text-white mb-2 sm:mb-4 break-words">
                  {t(item.titleKey)}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed break-words">
                  {t(item.descKey)}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className={`mt-10 sm:mt-16 text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-white dark:bg-gray-900 p-5 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl shadow-lg max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:mb-6">
              <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-red-500 flex-shrink-0" />
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {t('impactTitle')}
              </h3>
            </div>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              {t('impactText')}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
