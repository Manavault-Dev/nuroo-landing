'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { usePathname as useNextPathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { LocaleSwitcher } from './LocaleSwitcher'

const LANDING_LINKS = {
  features: '/#features',
  howItWorks: '/#solution-section',
  forProfessionals: '/#platform-section',
  pricing: '/#pricing',
} as const

export function Header() {
  const t = useTranslations('landing.nav')
  const fullPathname = useNextPathname() ?? ''
  const pathname = fullPathname.replace(/^\/(en|ru|ky)/, '') || '/'
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const isMarketplaceHero = pathname.startsWith('/marketplace') && !isScrolled

  const navLinkClass = clsx(
    'transition-colors text-sm whitespace-nowrap',
    isMarketplaceHero ? 'text-white/75 hover:text-white' : 'text-gray-600 hover:text-primary-500'
  )
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 min-w-0 border-b transition-all duration-200',
        isScrolled
          ? 'border-gray-100 bg-white/90 shadow-sm backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/90'
          : isMarketplaceHero
            ? 'border-white/10 bg-primary-950/10 backdrop-blur-md'
            : 'border-transparent bg-transparent'
      )}
    >
      <nav className="container-custom min-w-0">
        <div className="flex items-center justify-between h-14 md:h-16 gap-2 min-w-0">
          <Link
            href="/"
            className={clsx(
              'flex items-center space-x-2 text-xl md:text-2xl font-bold flex-shrink-0 min-w-0 transition-colors',
              isMarketplaceHero ? 'text-white' : 'gradient-text'
            )}
          >
            <img
              src="/Logo.svg"
              alt="Nuroo Logo"
              className={clsx(
                'w-6 h-6 md:w-8 md:h-8 rounded-lg transition-all',
                isMarketplaceHero && 'ring-1 ring-white/35 shadow-sm shadow-primary-950/20'
              )}
            />
            <span>Nuroo</span>
          </Link>

          <div className="hidden lg:flex items-center gap-3 xl:gap-5 flex-shrink-0">
            <Link href={LANDING_LINKS.features} className={navLinkClass}>
              {t('features')}
            </Link>
            <Link href={LANDING_LINKS.howItWorks} className={navLinkClass}>
              {t('howItWorks')}
            </Link>
            <Link href={LANDING_LINKS.forProfessionals} className={navLinkClass}>
              {t('forProfessionals')}
            </Link>
            <Link href={LANDING_LINKS.pricing} className={navLinkClass}>
              {t('pricing')}
            </Link>
            <Link href="/marketplace" className={clsx(navLinkClass, 'font-semibold')}>
              {t('marketplace')}
            </Link>
            <LocaleSwitcher inverse={isMarketplaceHero} />
            <div
              className={clsx(
                'h-4 w-px',
                isMarketplaceHero ? 'bg-white/30' : 'bg-gray-200 dark:bg-gray-600'
              )}
              aria-hidden
            />
            <Link
              href="/b2b/login"
              prefetch={false}
              className={clsx(
                'text-sm font-medium transition-colors',
                isMarketplaceHero
                  ? 'text-white/80 hover:text-white'
                  : 'text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400'
              )}
            >
              {t('logIn')}
            </Link>
            <Link
              href="/b2b/register"
              prefetch={false}
              className={clsx(
                isMarketplaceHero
                  ? 'rounded-lg bg-white px-4 py-2 text-sm font-semibold text-primary-700 shadow-sm shadow-primary-950/10 transition-all duration-200 hover:bg-primary-50 hover:shadow-md'
                  : 'btn-secondary text-sm'
              )}
            >
              {t('getStarted')}
            </Link>
            <a
              href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                isMarketplaceHero
                  ? 'rounded-lg bg-white/20 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/25 transition-all duration-200 hover:bg-white/30'
                  : 'btn-primary text-sm'
              )}
            >
              {t('downloadApp')}
            </a>
          </div>

          <div className="lg:hidden flex items-center gap-2 flex-shrink-0">
            <LocaleSwitcher inverse={isMarketplaceHero} />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={clsx(
                'p-2 rounded-lg transition-colors',
                isMarketplaceHero
                  ? 'bg-white/20 text-white ring-1 ring-white/25 hover:bg-white/30'
                  : 'bg-gray-100 hover:bg-gray-200'
              )}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? (
                <X className="h-4 w-4 md:h-5 md:w-5" />
              ) : (
                <Menu className="h-4 w-4 md:h-5 md:w-5" />
              )}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="lg:hidden min-w-0">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800 rounded-lg mt-2 shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-full">
              <Link
                href={LANDING_LINKS.features}
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('features')}
              </Link>
              <Link
                href={LANDING_LINKS.howItWorks}
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('howItWorks')}
              </Link>
              <Link
                href={LANDING_LINKS.forProfessionals}
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('forProfessionals')}
              </Link>
              <Link
                href={LANDING_LINKS.pricing}
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('pricing')}
              </Link>
              <Link
                href="/marketplace"
                className="block px-3 py-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('marketplace')}
              </Link>
              <div className="border-t border-gray-200 dark:border-gray-600 my-2 pt-2">
                <p className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('forProfessionalsLabel')}
                </p>
                <Link
                  href="/b2b/login"
                  prefetch={false}
                  className="block px-3 py-2 text-gray-700 dark:text-gray-200 hover:text-primary-500 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('logIn')}
                </Link>
                <Link
                  href="/b2b/register"
                  prefetch={false}
                  className="block px-3 py-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('createAccount')}
                </Link>
              </div>
              <a
                href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
                target="_blank"
                rel="noopener noreferrer"
                className="block mx-3 my-2 btn-primary text-center text-sm py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('downloadApp')}
              </a>
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
