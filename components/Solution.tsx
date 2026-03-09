'use client'

import { useTranslations } from 'next-intl'
import { CheckCircle } from 'lucide-react'

export function Solution() {
  const t = useTranslations('landing.solution')

  const stats = [
    { number: 90, suffix: '%', labelKey: 'parentSatisfaction' as const },
    { number: 3, suffix: 'x', labelKey: 'fasterProgress' as const },
    { number: 85, suffix: '%', labelKey: 'costReduction' as const },
    { number: null, static: '24/7', labelKey: 'availableSupport' as const },
  ]

  return (
    <section id="solution-section" className="section-padding bg-white dark:bg-gray-900 min-w-0">
      <div className="container-custom min-w-0">
        <div className="max-w-4xl mx-auto text-center mb-8 sm:mb-12 md:mb-16">
          <div
            data-sr
            className="sr-up sr-duration-700 sr-delay-0 inline-flex items-center px-3 md:px-4 py-2 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs md:text-sm font-medium mb-4 sm:mb-6 md:mb-8"
          >
            <CheckCircle className="w-3 h-3 md:w-4 md:h-4 mr-2" />
            {t('badge')}
          </div>
          <h2
            data-sr
            className="sr-up sr-duration-700 sr-delay-100 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6 px-1 break-words"
          >
            {t('title')}
            <span className="gradient-text ml-2 md:ml-3">{t('titleBrand')}</span>
          </h2>
          <p
            data-sr
            className="sr-up sr-duration-700 sr-delay-200 text-sm sm:text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 sm:mb-8 md:mb-12 break-words"
          >
            {t('intro')}
          </p>
          {t('platformIntro') ? (
            <p
              data-sr
              className="sr-up sr-duration-700 sr-delay-300 text-sm sm:text-base md:text-lg text-gray-500 dark:text-gray-400 mb-6 sm:mb-8 md:mb-12 break-words"
            >
              {t('platformIntro')}
            </p>
          ) : null}
        </div>

        <div className="mb-10 sm:mb-16 md:mb-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-8 sm:mb-12 md:mb-16 min-w-0">
            <div
              data-sr
              className="sr-up sr-duration-700 sr-delay-100 relative group min-w-0 glow-card rounded-2xl md:rounded-3xl"
            >
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/welcome.png"
                    alt="Nuroo"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-primary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">1</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {t('welcomeSetup')}
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  {t('welcomeSetupDesc')}
                </p>
              </div>
            </div>
            <div
              data-sr
              className="sr-up sr-duration-700 sr-delay-200 relative group min-w-0 glow-card rounded-2xl md:rounded-3xl"
            >
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/progress.png"
                    alt="Nuroo"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-secondary-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">2</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {t('progressTracking')}
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  {t('progressTrackingDesc')}
                </p>
              </div>
            </div>
            <div
              data-sr
              className="sr-up sr-duration-700 sr-delay-300 relative group sm:col-span-2 lg:col-span-1 min-w-0 glow-card rounded-2xl md:rounded-3xl"
            >
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-lg border border-primary-200 group-hover:shadow-xl transition-all duration-300">
                <div className="bg-white dark:bg-gray-900 rounded-xl md:rounded-2xl p-2 md:p-3">
                  <img
                    src="/asknuroo-screen.png"
                    alt="NurooAi"
                    className="w-full h-auto rounded-lg md:rounded-xl shadow-lg"
                  />
                </div>
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-6 h-6 md:w-8 md:h-8 bg-accent-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">3</span>
                </div>
              </div>
              <div className="text-center mt-3 md:mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                  {t('nurooAiChat')}
                </h4>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300">
                  {t('nurooAiChatDesc')}
                </p>
              </div>
            </div>
          </div>

          <div
            data-sr
            className="sr-up sr-duration-700 sr-delay-200 text-center max-w-4xl mx-auto"
          >
            <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4 md:mb-6">
              {t('allInOneTitle')}
              <span className="gradient-text"> {t('allInOneHighlight')}</span>
            </h3>
            <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 md:mb-8 leading-relaxed">
              {t('allInOneDesc')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div
                data-sr
                className="sr-left sr-duration-700 sr-delay-100 flex items-start space-x-3"
              >
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    {t('personalizedLearning')}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    {t('personalizedLearningDesc')}
                  </p>
                </div>
              </div>
              <div
                data-sr
                className="sr-up sr-duration-700 sr-delay-200 flex items-start space-x-3"
              >
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    {t('nurooAiSupport')}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    {t('nurooAiSupportDesc')}
                  </p>
                </div>
              </div>
              <div
                data-sr
                className="sr-right sr-duration-700 sr-delay-300 flex items-start space-x-3"
              >
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                <div className="text-left">
                  <h4 className="font-semibold text-gray-900 dark:text-white text-sm md:text-base">
                    {t('realtimeProgress')}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 text-xs md:text-sm">
                    {t('realtimeProgressDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
          data-sr
          className="sr-scale sr-duration-900 sr-delay-200 bg-gradient-to-r from-primary-100 to-secondary-100 rounded-2xl md:rounded-3xl p-6 md:p-8 border border-primary-200"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-2xl md:text-3xl lg:text-4xl font-bold mb-1 md:mb-2 stat-number">
                  {stat.static ? (
                    stat.static
                  ) : (
                    <span
                      data-count-target={stat.number}
                      data-count-suffix={stat.suffix}
                    >
                      0{stat.suffix}
                    </span>
                  )}
                </div>
                <div className="text-primary-600 text-xs md:text-sm">{t(stat.labelKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
