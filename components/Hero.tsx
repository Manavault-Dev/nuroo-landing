'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Star, Users, Heart, Building2, UserCircle } from 'lucide-react'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'

export function Hero() {
  const t = useTranslations('landing.hero')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gentle-50 via-white to-primary-50 pt-20 md:pt-0 min-w-0">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-4 md:left-10 w-48 md:w-72 h-48 md:h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-30"></div>
        <div
          className="absolute top-40 right-4 md:right-10 w-48 md:w-72 h-48 md:h-72 bg-secondary-200 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-30"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="absolute -bottom-8 left-8 md:left-20 w-48 md:w-72 h-48 md:h-72 bg-gentle-300 rounded-full mix-blend-multiply filter blur-xl animate-bounce-gentle opacity-20"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      <div className="container-custom relative z-10 min-w-0 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center min-w-0">
          <div className="text-center lg:text-left min-w-0">
            <div
              className={`inline-flex items-center px-3 md:px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-xs md:text-sm font-medium mb-6 md:mb-8 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <Star className="w-3 h-3 md:w-4 md:h-4 mr-2" />
              <span className="hidden sm:inline">{t('badge')}</span>
              <span className="sm:hidden">{t('badgeShort')}</span>
            </div>

            <h1
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 transition-all duration-700 delay-200 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <span className="gradient-text">{t('headline1')}</span>
              <br />
              <span className="text-gray-900 dark:text-gray-100">{t('headline2')}</span>
              <br />
              <span className="text-gray-600 dark:text-gray-300">{t('headline3')}</span>
            </h1>

            <p
              className={`text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 md:mb-8 leading-relaxed transition-all duration-700 delay-300 break-words ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              {t('subtitle')}
            </p>

            <div
              className={`flex flex-wrap justify-center lg:justify-start items-center gap-4 mb-6 transition-all duration-700 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <AppStoreButton />
              <GooglePlayButton disabled />
            </div>

            <div
              className={`mb-8 md:mb-12 transition-all duration-700 delay-450 min-w-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <div className="inline-flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 shadow-sm backdrop-blur-sm max-w-full min-w-0">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 min-w-0">
                  <Building2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <UserCircle className="w-4 h-4 text-secondary-500 flex-shrink-0" />
                  <span className="text-sm font-medium break-words">
                    {t('organizersSpecialists')}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <Link
                    href="/b2b/login"
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    {t('logIn')}
                  </Link>
                  <Link
                    href="/b2b/register"
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors shadow-sm"
                  >
                    {t('createAccount')}
                  </Link>
                </div>
              </div>
            </div>

            <div
              className={`grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 transition-all duration-700 delay-500 min-w-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            >
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-primary-500 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                    {t('stat1Value')}
                  </span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">
                  {t('stat1Label')}
                </p>
              </div>
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Heart className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-secondary-400 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                    {t('stat2Value')}
                  </span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">
                  {t('stat2Label')}
                </p>
              </div>
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-6 md:h-6 text-primary-400 mr-1 sm:mr-2" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                    {t('stat3Value')}
                  </span>
                </div>
                <p className="text-xs sm:text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">
                  {t('stat3Label')}
                </p>
              </div>
            </div>
          </div>

          <div
            className={`relative transition-all duration-700 delay-600 min-w-0 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="relative">
              <div className="absolute -top-2 md:-top-4 -right-2 md:-right-4 w-20 md:w-32 h-20 md:h-32 bg-primary-200 rounded-full opacity-20"></div>
              <div className="absolute -bottom-2 md:-bottom-4 -left-2 md:-left-4 w-16 md:w-24 h-16 md:h-24 bg-secondary-200 rounded-full opacity-20"></div>
              <div className="relative bg-gradient-to-br from-primary-100 to-secondary-100 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl">
                <img
                  src="/mother-and-child.png"
                  alt="Nuroo"
                  className="w-full h-auto rounded-xl md:rounded-2xl shadow-lg"
                />
                <div className="absolute -top-1 md:-top-2 -right-1 md:-right-2 w-12 md:w-16 h-12 md:h-16 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <img src="/globe.png" alt="" className="w-6 h-6 md:w-8 md:h-8" />
                </div>
                <div className="absolute -bottom-1 md:-bottom-2 -left-1 md:-left-2 w-10 md:w-12 h-10 md:h-12 bg-white rounded-full shadow-lg flex items-center justify-center">
                  <Heart className="w-4 h-4 md:w-6 md:h-6 text-primary-500" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-gray-400 dark:border-gray-500 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-gray-400 dark:bg-gray-500 rounded-full mt-2 animate-pulse"></div>
        </div>
      </div>
    </section>
  )
}
