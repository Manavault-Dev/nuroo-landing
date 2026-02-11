'use client'

import { useState, useEffect } from 'react'
import {
  Brain,
  MessageCircle,
  BarChart3,
  Shield,
  Clock,
  Users,
  Smartphone,
  Heart,
  Star,
  Zap,
  Target,
  Award,
  Building2,
  Video,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'

export function Features() {
  const t = useTranslations('landing.features')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setIsVisible(true),
      { threshold: 0.1 }
    )
    const el = document.getElementById('features')
    if (el) observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const mainFeatures = [
    {
      icon: <Brain className="w-8 h-8 text-primary-500" />,
      titleKey: 'aiLearning',
      descKey: 'aiLearningDesc',
      benefitsKey: 'aiLearningBenefits',
      gradient: 'from-primary-300 to-primary-400',
    },
    {
      icon: <MessageCircle className="w-8 h-8 text-secondary-400" />,
      titleKey: 'nurooAiChat',
      descKey: 'nurooAiChatDesc',
      benefitsKey: 'nurooAiChatBenefits',
      gradient: 'from-secondary-300 to-secondary-400',
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-accent-400" />,
      titleKey: 'progressAnalytics',
      descKey: 'progressAnalyticsDesc',
      benefitsKey: 'progressAnalyticsBenefits',
      gradient: 'from-accent-300 to-accent-400',
    },
    {
      icon: <Shield className="w-8 h-8 text-success-500" />,
      titleKey: 'privacySecurity',
      descKey: 'privacySecurityDesc',
      benefitsKey: 'privacySecurityBenefits',
      gradient: 'from-success-300 to-success-400',
    },
  ] as const

  const additionalFeatures = [
    {
      icon: <Clock className="w-6 h-6" />,
      titleKey: 'flexibleScheduling',
      descKey: 'flexibleSchedulingDesc',
    },
    {
      icon: <Users className="w-6 h-6" />,
      titleKey: 'familySupport',
      descKey: 'familySupportDesc',
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      titleKey: 'mobileFirst',
      descKey: 'mobileFirstDesc',
    },
    {
      icon: <Heart className="w-6 h-6" />,
      titleKey: 'emotionalSupport',
      descKey: 'emotionalSupportDesc',
    },
    { icon: <Star className="w-6 h-6" />, titleKey: 'gamification', descKey: 'gamificationDesc' },
    { icon: <Zap className="w-6 h-6" />, titleKey: 'quickSetup', descKey: 'quickSetupDesc' },
    { icon: <Target className="w-6 h-6" />, titleKey: 'goalSetting', descKey: 'goalSettingDesc' },
    {
      icon: <Award className="w-6 h-6" />,
      titleKey: 'achievementSystem',
      descKey: 'achievementSystemDesc',
    },
  ] as const

  return (
    <section id="features" className="section-padding bg-gray-50 dark:bg-gray-800 min-w-0">
      <div className="container-custom min-w-0">
        <div className="max-w-4xl mx-auto text-center mb-10 sm:mb-16">
          <div
            className={`inline-flex items-center px-3 sm:px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs sm:text-sm font-medium mb-6 sm:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
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
          className={`mb-10 sm:mb-16 transition-all duration-700 delay-350 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-primary-200 dark:border-primary-800">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                  <Building2 className="w-6 h-6 text-primary-500" />
                </div>
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                  <Video className="w-6 h-6 text-secondary-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {t('forProfsTitle')}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-sm md:text-base">
                    {t('forProfsDesc')}
                  </p>
                </div>
              </div>
              <Link
                href="#platform-section"
                className="inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 bg-white dark:bg-gray-800 rounded-lg border border-primary-200 dark:border-primary-700 hover:shadow-md transition-all shrink-0"
              >
                {t('learnMore')}
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-20 min-w-0">
          {mainFeatures.map((feature, index) => {
            const benefits = [0, 1, 2].map((i) => t(`${feature.benefitsKey}.${i}`))
            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-900 p-5 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-lg hover:shadow-xl transition-all duration-500 card-hover group min-w-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <div
                  className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-gradient-to-r ${feature.gradient} rounded-xl sm:rounded-2xl flex items-center justify-center mb-4 sm:mb-6 group-hover:scale-110 transition-transform duration-300`}
                >
                  {feature.icon}
                </div>
                <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
                  {t(feature.titleKey)}
                </h3>
                <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mb-4 sm:mb-6 leading-relaxed">
                  {t(feature.descKey)}
                </p>
                <div className="space-y-3">
                  {benefits.map((benefit, bi) => (
                    <div key={bi} className="flex items-center space-x-3">
                      <div
                        className={`w-2 h-2 bg-gradient-to-r ${feature.gradient} rounded-full`}
                      />
                      <span className="text-gray-700 dark:text-gray-300 font-medium">
                        {benefit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div
          className={`mb-10 sm:mb-16 transition-all duration-700 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <h3 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-white text-center mb-6 sm:mb-12">
            {t('andMore')}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {additionalFeatures.map((feature, index) => (
              <div
                key={index}
                className="bg-white dark:bg-gray-900 p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg transition-all duration-300 group hover:-translate-y-1"
              >
                <div className="flex items-center justify-center w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl mb-4 group-hover:bg-primary-100 dark:group-hover:bg-primary-900 transition-colors">
                  <div className="text-primary-500 group-hover:scale-110 transition-transform">
                    {feature.icon}
                  </div>
                </div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 text-center">
                  {t(feature.titleKey)}
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          className={`text-center transition-all duration-700 delay-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        >
          <div className="bg-gradient-to-r from-primary-100 to-secondary-100 dark:from-primary-900/30 dark:to-secondary-900/30 rounded-2xl sm:rounded-3xl p-6 sm:p-8 md:p-12 border border-primary-200 dark:border-primary-800">
            <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-4 sm:mb-6 text-gray-900 dark:text-white">
              {t('ctaTitle')}
            </h3>
            <p className="text-base sm:text-lg md:text-xl mb-6 sm:mb-8 text-gray-700 dark:text-gray-300">
              {t('ctaSubtitle')}
            </p>
            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4">
              <AppStoreButton />
              <GooglePlayButton disabled />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
