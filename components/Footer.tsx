'use client'

import { Link as I18nLink } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'
import { Linkedin, Instagram, ArrowUp } from 'lucide-react'
import { useState, useEffect } from 'react'

export function Footer() {
  const t = useTranslations('landing.footer')
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const socialLinks = [
    { name: 'LinkedIn', href: 'https://www.linkedin.com/company/nuroo-ai/', icon: Linkedin },
    { name: 'Instagram', href: 'https://www.instagram.com/nuroo.global/', icon: Instagram },
  ]

  const navLinks = [
    { href: '#features', labelKey: 'features' as const },
    { href: '#solution-section', labelKey: 'howItWorks' as const },
    { href: '#platform-section', labelKey: 'forProfessionals' as const },
    { href: '/help', labelKey: 'help' as const },
    { href: '/privacy', labelKey: 'privacy' as const },
    {
      href: 'https://apps.apple.com/us/app/nuroo-ai/id6753772410',
      labelKey: 'downloadApp' as const,
      external: true,
    },
    { href: '/b2b/login', labelKey: 'logInB2b' as const },
  ]

  return (
    <footer className="bg-primary-600 text-white relative min-w-0 overflow-x-hidden">
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed z-50 w-12 h-12 min-w-[48px] min-h-[48px] bg-primary-500 hover:bg-primary-700 active:scale-95 rounded-full flex items-center justify-center shadow-lg transition-all duration-300 hover:scale-105 border-2 border-white/20"
          style={{
            bottom: 'max(1rem, env(safe-area-inset-bottom))',
            right: 'max(1rem, env(safe-area-inset-right))',
          }}
          aria-label={t('scrollToTop')}
        >
          <ArrowUp className="w-5 h-5 text-white" />
        </button>
      )}

      <div className="container-custom min-w-0">
        {/* Main block: logo + tagline | nav | social */}
        <div className="py-8 sm:py-10">
          <div className="flex flex-col gap-8 lg:gap-10 min-w-0">
            {/* Top row: logo + tagline, then social on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-w-0">
                <I18nLink href="/" className="flex items-center gap-2 w-fit flex-shrink-0">
                  <img
                    src="/logo.png"
                    alt="Nuroo"
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex-shrink-0"
                  />
                  <span className="font-semibold text-lg text-white">Nuroo</span>
                </I18nLink>
                <p className="text-white/80 text-sm max-w-xs break-words min-w-0">{t('tagline')}</p>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                {socialLinks.map((social) => {
                  const Icon = social.icon
                  return (
                    <a
                      key={social.name}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                      aria-label={social.name}
                    >
                      <Icon className="w-5 h-5" />
                    </a>
                  )
                })}
              </div>
            </div>

            {/* Nav links: wrap cleanly with spacing */}
            <nav
              className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-2 text-sm min-w-0 break-words"
              aria-label="Footer navigation"
            >
              {navLinks.map((link) =>
                link.external ? (
                  <a
                    key={link.labelKey}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    {t(link.labelKey)}
                  </a>
                ) : (
                  <I18nLink
                    key={link.labelKey}
                    href={link.href}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    {t(link.labelKey)}
                  </I18nLink>
                )
              )}
            </nav>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-white/20 py-4 sm:py-5">
          <p className="text-center text-white/70 text-xs sm:text-sm">{t('copyright')}</p>
        </div>
      </div>
    </footer>
  )
}
