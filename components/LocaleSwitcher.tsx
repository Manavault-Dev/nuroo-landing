'use client'

import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useRouter } from '@/i18n/navigation'
import { useTransition, useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { type Locale } from '@/i18n/routing'
import { Globe } from 'lucide-react'
import { clsx } from 'clsx'

const localeNames: Record<Locale, string> = {
  en: 'EN',
  ru: 'RU',
  ky: 'KY',
}

export function LocaleSwitcher() {
  const t = useTranslations('common')
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const handleChange = (newLocale: Locale) => {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale })
    })
    setIsOpen(false)
  }

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }
    const timer = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('touchstart', handleClickOutside, { passive: true })
    })
    return () => {
      cancelAnimationFrame(timer)
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [isOpen])

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current) {
      setPosition(null)
      return
    }
    const el = buttonRef.current
    const rect = el.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - 128), // w-32=128px, align right; min 8px from viewport left
    })
  }, [isOpen])

  const dropdown = isOpen && position && typeof document !== 'undefined' && (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label={t('locale')}
      className="fixed w-32 py-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-[9999]"
      style={{ top: position.top, left: position.left }}
    >
      {(['en', 'ru', 'ky'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          role="option"
          aria-selected={locale === loc}
          onClick={() => handleChange(loc)}
          className={clsx(
            'w-full text-left px-3 py-2 text-sm transition-colors min-h-[44px] sm:min-h-0 flex items-center',
            locale === loc
              ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          )}
        >
          {t(loc)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="relative" title={t('locale')}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white bg-gray-100/80 dark:bg-gray-800/80 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label={t('locale')}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={isPending}
      >
        <Globe className="w-4 h-4" />
        <span>{localeNames[locale]}</span>
      </button>
      {typeof document !== 'undefined' &&
        isOpen &&
        position &&
        createPortal(dropdown, document.body)}
    </div>
  )
}
