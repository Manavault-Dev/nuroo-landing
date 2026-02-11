'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'

export function Testimonials() {
  const t = useTranslations('landing.testimonials')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.1 }
    )
    const el = document.getElementById('testimonials-section')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="testimonials-section"
      className="section-padding bg-white dark:bg-gray-900 min-w-0"
    >
      <div className="container-custom min-w-0">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-16">
          <div
            className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          >
            <Star className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            className={`text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6 transition-all duration-700 delay-200 px-1 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('title')}
            <span className="gradient-text ml-2 sm:ml-3">{t('titleHighlight')}</span>
          </h2>
          <p
            className={`text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 sm:mb-12 transition-all duration-700 delay-300 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {t('intro')}
          </p>
        </div>
        <div
          className={`mt-10 sm:mt-16 text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 border border-primary-200 dark:border-primary-800">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              <div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-white">
                  {t('available')}
                </div>
                <div className="text-sm sm:text-base text-primary-600 dark:text-primary-400">
                  {t('appStore')}
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-white">
                  {t('aiPowered')}
                </div>
                <div className="text-sm sm:text-base text-primary-600 dark:text-primary-400">
                  {t('technology')}
                </div>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2 text-gray-900 dark:text-white">
                  {t('joinNow')}
                </div>
                <div className="text-sm sm:text-base text-primary-600 dark:text-primary-400">
                  {t('earlyAccess')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
