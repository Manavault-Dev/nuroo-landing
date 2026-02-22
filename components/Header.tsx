'use client'

import { useState, useEffect } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { LocaleSwitcher } from './LocaleSwitcher'

export function Header() {
  const t = useTranslations('landing.nav')
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-200 min-w-0',
        isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm dark:bg-gray-900/90' : 'bg-transparent'
      )}
    >
      <nav className="container-custom min-w-0">
        <div className="flex items-center justify-between h-14 md:h-16 gap-2 min-w-0">
          <Link
            href="/"
            className="flex items-center space-x-2 text-xl md:text-2xl font-bold gradient-text flex-shrink-0 min-w-0"
          >
            <img src="/logo.png" alt="Nuroo Logo" className="w-6 h-6 md:w-8 md:h-8 rounded-lg" />
            <span>Nuroo</span>
          </Link>

          <div className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              href="#features"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('features')}
            </Link>
            <Link
              href="#solution-section"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('howItWorks')}
            </Link>
            <Link
              href="#platform-section"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('forProfessionals')}
            </Link>
            <Link
              href="#pricing"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('pricing')}
            </Link>
            <Link
              href="/help"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('help')}
            </Link>
            <Link
              href="/privacy"
              className="text-gray-600 hover:text-primary-500 transition-colors text-sm"
            >
              {t('privacy')}
            </Link>
            <LocaleSwitcher />
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-600" aria-hidden />
            <Link
              href="/b2b/login"
              className="text-sm font-medium text-gray-700 hover:text-primary-600 dark:text-gray-300 dark:hover:text-primary-400 transition-colors"
            >
              {t('logIn')}
            </Link>
            <Link href="/b2b/register" className="btn-secondary text-sm">
              {t('getStarted')}
            </Link>
            <a
              href="https://apps.apple.com/us/app/nuroo-ai/id6753772410"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-sm"
            >
              {t('downloadApp')}
            </a>
          </div>

          <div className="md:hidden flex items-center gap-2 flex-shrink-0">
            <LocaleSwitcher />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
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
          <div className="md:hidden min-w-0">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white dark:bg-gray-800 rounded-lg mt-2 shadow-lg border border-gray-200 dark:border-gray-700 w-full max-w-full">
              <Link
                href="#features"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('features')}
              </Link>
              <Link
                href="#solution-section"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('howItWorks')}
              </Link>
              <Link
                href="#platform-section"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('forProfessionals')}
              </Link>
              <Link
                href="#pricing"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('pricing')}
              </Link>
              <Link
                href="/help"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('help')}
              </Link>
              <Link
                href="/privacy"
                className="block px-3 py-2 text-gray-600 dark:text-gray-300 hover:text-primary-500 transition-colors text-sm font-medium"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('privacy')}
              </Link>
              <div className="border-t border-gray-200 dark:border-gray-600 my-2 pt-2">
                <p className="px-3 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('forProfessionalsLabel')}
                </p>
                <Link
                  href="/b2b/login"
                  className="block px-3 py-2 text-gray-700 dark:text-gray-200 hover:text-primary-500 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t('logIn')}
                </Link>
                <Link
                  href="/b2b/register"
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
