'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Users, Heart, Star, Building2, UserCircle, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'

export function Hero() {
  const t = useTranslations('landing.hero')
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gentle-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-900 dark:to-primary-950/20 pt-24 md:pt-28 min-w-0">
      <style>{`
        @keyframes orb-drift-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(50px, -40px) scale(1.08); }
          66%       { transform: translate(-30px, 25px) scale(0.95); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%       { transform: translate(-40px, 50px) scale(1.05); }
          66%       { transform: translate(35px, -25px) scale(0.92); }
        }
        @keyframes shimmer-badge {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }
        @keyframes hero-gradient {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }
        @keyframes float-card {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-10px); }
        }
        @keyframes hero-scroll-dot {
          0%        { opacity: 1; transform: translateY(0); }
          80%, 100% { opacity: 0; transform: translateY(14px); }
        }
        @keyframes hero-pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }
        .hero-gradient-text {
          background: linear-gradient(135deg, #0d9488, #14b8a6, #2dd4bf, #0891b2, #0d9488);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: hero-gradient 5s ease infinite;
        }
        .hero-badge-shimmer {
          background: linear-gradient(90deg, #ccfbf1, #a7f3d0, #5eead4, #99f6e4, #ccfbf1);
          background-size: 300% auto;
          animation: shimmer-badge 4s linear infinite;
        }
        .hero-orb-1 { animation: orb-drift-1 14s ease-in-out infinite; }
        .hero-orb-2 { animation: orb-drift-2 18s ease-in-out infinite; }
        .hero-orb-3 { animation: orb-drift-1 22s ease-in-out 4s infinite; }
        .hero-float-0 { animation: float-card 6s ease-in-out infinite; }
        .hero-float-1 { animation: float-card 7.5s ease-in-out 1.5s infinite; }
        .hero-float-2 { animation: float-card 5.5s ease-in-out 0.8s infinite; }
        .hero-scroll-dot { animation: hero-scroll-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        .hero-pulse-dot  { animation: hero-pulse-dot 2s ease-in-out infinite; }
      `}</style>

      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <defs>
          <pattern id="hero-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#14b8a6" opacity="0.13" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      {/* Animated gradient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="hero-orb-1 absolute -top-24 -left-24 w-[480px] h-[480px] bg-primary-200/35 dark:bg-primary-700/15 rounded-full blur-3xl" />
        <div className="hero-orb-2 absolute top-1/3 -right-24 w-96 h-96 bg-secondary-200/30 dark:bg-secondary-700/15 rounded-full blur-3xl" />
        <div className="hero-orb-3 absolute -bottom-24 left-1/3 w-80 h-80 bg-teal-200/25 dark:bg-teal-700/10 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10 min-w-0 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center min-w-0">

          {/* Left: Copy */}
          <div className="text-center lg:text-left min-w-0">

            {/* Badge */}
            <div
              className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 md:mb-8 hero-badge-shimmer transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
            >
              <span className="hero-pulse-dot inline-block w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
              <span className="hidden sm:inline">{t('badge')}</span>
              <span className="sm:hidden">{t('badgeShort')}</span>
            </div>

            {/* Headline */}
            <h1
              className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-6 leading-tight break-words transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '150ms' }}
            >
              <span className="hero-gradient-text">{t('headline1')}</span>
              <br />
              <span className="text-gray-900 dark:text-gray-100">{t('headline2')}</span>
              <br />
              <span className="text-gray-500 dark:text-gray-400">{t('headline3')}</span>
            </h1>

            {/* Subtitle */}
            <p
              className={`text-base md:text-lg lg:text-xl text-gray-600 dark:text-gray-300 mb-6 md:mb-8 leading-relaxed break-words transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '300ms' }}
            >
              {t('subtitle')}
            </p>

            {/* App buttons */}
            <div
              className={`flex flex-wrap justify-center lg:justify-start items-center gap-4 mb-6 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '400ms' }}
            >
              <AppStoreButton />
              <GooglePlayButton />
            </div>

            {/* B2B CTA box */}
            <div
              className={`mb-8 md:mb-12 min-w-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '480ms' }}
            >
              <div className="inline-flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/80 dark:bg-gray-800/80 border border-gray-200/80 dark:border-gray-700/80 shadow-sm backdrop-blur-sm max-w-full min-w-0">
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200 min-w-0">
                  <Building2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <UserCircle className="w-4 h-4 text-secondary-500 flex-shrink-0" />
                  <span className="text-sm font-medium break-words">{t('organizersSpecialists')}</span>
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

            {/* Stats */}
            <div
              className={`grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 min-w-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: '560ms' }}
            >
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Users className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-primary-500 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">{t('stat1Value')}</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">{t('stat1Label')}</p>
              </div>
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Heart className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-secondary-400 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">{t('stat2Value')}</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">{t('stat2Label')}</p>
              </div>
              <div className="text-center lg:text-left min-w-0">
                <div className="flex items-center justify-center lg:justify-start mb-1 md:mb-2">
                  <Star className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 text-primary-400 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="text-sm sm:text-lg md:text-2xl font-bold text-gray-900 dark:text-white">{t('stat3Value')}</span>
                </div>
                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-tight break-words">{t('stat3Label')}</p>
              </div>
            </div>
          </div>

          {/* Right: Image + floating cards */}
          <div
            className={`relative min-w-0 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            style={{ transitionDelay: '600ms' }}
          >
            <div className="relative">
              {/* Glow behind image */}
              <div className="absolute inset-8 bg-primary-400/25 dark:bg-primary-500/10 blur-3xl rounded-full pointer-events-none" />

              {/* Image card */}
              <div className="relative bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/40 dark:to-secondary-900/30 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl">
                <img
                  src="/mother-and-child.png"
                  alt="Nuroo"
                  className="w-full h-auto rounded-xl md:rounded-2xl shadow-lg"
                />
              </div>

              {/* Floating card: task done */}
              <div className="hero-float-0 absolute -top-3 right-2 sm:-top-4 sm:-right-6 hidden sm:flex items-center gap-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-xl border border-gray-100/80 dark:border-gray-700/80 z-10">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">Задача выполнена</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">Моторика · 5 мин назад</p>
                </div>
              </div>

              {/* Floating card: progress */}
              <div className="hero-float-1 absolute -bottom-3 left-2 sm:-bottom-4 sm:-left-6 hidden sm:flex items-center gap-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-xl border border-gray-100/80 dark:border-gray-700/80 z-10">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">Прогресс +18%</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">За эту неделю</p>
                </div>
              </div>

              {/* Floating card: AI plan */}
              <div className="hero-float-2 absolute top-1/2 right-0 lg:-right-10 hidden lg:flex items-center gap-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl px-3.5 py-2.5 shadow-xl border border-gray-100/80 dark:border-gray-700/80 z-10">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-violet-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">ИИ-план готов</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">3 новых упражнения</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-50">
        <div className="w-5 h-9 border-2 border-gray-400 dark:border-gray-500 rounded-full flex justify-center pt-2">
          <div className="hero-scroll-dot w-1 h-2.5 bg-primary-400 rounded-full" />
        </div>
      </div>
    </section>
  )
}
