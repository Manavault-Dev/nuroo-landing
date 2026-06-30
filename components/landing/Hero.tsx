import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { Users, CheckCircle2, TrendingUp } from 'lucide-react'
import { AppStoreButton } from './AppStoreButton'
import { GooglePlayButton } from './GooglePlayButton'

export async function Hero() {
  const t = await getTranslations('landing.hero')

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-gentle-50 via-white to-primary-50 dark:from-gray-950 dark:via-gray-900 dark:to-primary-950/20 pt-24 md:pt-28 min-w-0">
      {/* Dot grid — decorative, no paint cost */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
        <defs>
          <pattern id="hero-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#14b8a6" opacity="0.13" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>

      {/* Animated orbs — desktop only, lower blur for perf */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block"
        aria-hidden
      >
        <div className="hero-orb-1 absolute -top-24 -left-24 w-[480px] h-[480px] bg-primary-200/35 dark:bg-primary-700/15 rounded-full blur-2xl will-change-transform" />
        <div className="hero-orb-2 absolute top-1/3 -right-24 w-96 h-96 bg-secondary-200/30 dark:bg-secondary-700/15 rounded-full blur-2xl will-change-transform" />
        <div className="hero-orb-3 absolute -bottom-24 left-1/3 w-80 h-80 bg-teal-200/25 dark:bg-teal-700/10 rounded-full blur-2xl will-change-transform" />
      </div>

      <div className="container-custom relative z-10 min-w-0 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center min-w-0">
          {/* Left: Copy — on mobile rendered second (image is LCP, must be first in viewport) */}
          <div className="order-2 lg:order-1 text-center lg:text-left min-w-0">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 md:mb-8 hero-badge-shimmer">
              <span className="hero-pulse-dot inline-block w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
              <span className="hidden sm:inline">{t('badge')}</span>
              <span className="sm:hidden">{t('badgeShort')}</span>
            </div>

            {/* h1 — LCP candidate, must be immediately visible */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 md:mb-5 leading-tight break-words">
              <span className="hero-gradient-text">{t('headline1')}</span>
              <br />
              <span className="text-gray-900 dark:text-white">{t('headline2')}</span>
            </h1>

            <p className="text-base md:text-lg text-gray-600 dark:text-gray-300 mb-6 md:mb-8 max-w-xl leading-relaxed break-words">
              {t('subtitle')}
            </p>

            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-4 mb-8">
              <AppStoreButton />
              <GooglePlayButton />
            </div>

            <div className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800/50 min-w-0">
              <Users className="w-6 h-6 text-primary-500 flex-shrink-0" />
              <p className="text-base md:text-lg text-gray-800 dark:text-gray-100 font-semibold">
                {t('statMain')}
              </p>
            </div>
          </div>

          {/* Right: Image — LCP element, first in DOM on mobile (order-1), priority load */}
          <div className="order-1 lg:order-2 relative min-w-0">
            <div className="relative">
              <div className="absolute inset-8 bg-primary-400/25 dark:bg-primary-500/10 blur-2xl rounded-full pointer-events-none hidden md:block" />

              <div className="relative bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/40 dark:to-secondary-900/30 p-4 md:p-8 rounded-2xl md:rounded-3xl shadow-2xl">
                <Image
                  src="/mother-and-child.webp"
                  alt="Nuroo — поддержка детей с особыми потребностями"
                  width={600}
                  height={450}
                  priority
                  fetchPriority="high"
                  sizes="(max-width: 1023px) 100vw, 50vw"
                  className="w-full h-auto rounded-xl md:rounded-2xl shadow-lg"
                />
              </div>

              {/* Floating cards — desktop only */}
              <div className="hero-float-0 absolute -top-3 right-2 sm:-top-4 sm:-right-6 hidden sm:flex items-center gap-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl px-3.5 py-2.5 shadow-xl border border-gray-100/80 dark:border-gray-700/80 z-10">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                    {t('taskCompleted')}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {t('floatCardCategory')} · {t('floatCardTime')}
                  </p>
                </div>
              </div>

              <div className="hero-float-1 absolute -bottom-3 left-2 sm:-bottom-4 sm:-left-6 hidden sm:flex items-center gap-2.5 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl px-3.5 py-2.5 shadow-xl border border-gray-100/80 dark:border-gray-700/80 z-10">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 whitespace-nowrap">
                    {t('floatCardProgress')}
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {t('floatCardWeek')}
                  </p>
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
