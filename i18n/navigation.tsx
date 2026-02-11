'use client'

import Link from 'next/link'
import { usePathname as useNextPathname, useRouter as useNextRouter, useParams } from 'next/navigation'
import type { ComponentProps } from 'react'

// Server-safe constants (can be imported from navigation-config.ts if needed)
const LOCALES = ['en', 'ru', 'ky'] as const
const DEFAULT_LOCALE = 'en'

function getLocaleFromPathname(pathname: string): string {
  const segment = pathname.split('/')[1]
  return segment && LOCALES.includes(segment as (typeof LOCALES)[number]) ? segment : DEFAULT_LOCALE
}

export type Locale = (typeof LOCALES)[number]

/** Pathname without locale prefix (e.g. /en/b2b/login -> /b2b/login) */
export function usePathname(): string {
  const pathname = useNextPathname() ?? ''
  const locale = getLocaleFromPathname(pathname)
  if (pathname.startsWith(`/${locale}`)) {
    const withoutLocale = pathname.slice(locale.length + 1)
    return withoutLocale || '/'
  }
  return pathname || '/'
}

/** Current locale from URL segment */
export function useLocale(): string {
  const params = useParams()
  const locale = params?.locale
  return typeof locale === 'string' && LOCALES.includes(locale as Locale) ? locale : DEFAULT_LOCALE
}

/** Router that prepends current locale to paths */
export function useRouter() {
  const nextRouter = useNextRouter()
  const pathname = useNextPathname() ?? ''
  const locale = getLocaleFromPathname(pathname)

  return {
    push: (href: string, options?: { locale?: string }) => {
      const loc = options?.locale ?? locale
      const url = href.startsWith('#') ? `${pathname}${href}` : href.startsWith('http') ? href : `/${loc}${href === '/' ? '' : href}`
      return nextRouter.push(url)
    },
    replace: (href: string, options?: { locale?: string }) => {
      const loc = options?.locale ?? locale
      const url = href.startsWith('#') ? `${pathname}${href}` : href.startsWith('http') ? href : `/${loc}${href === '/' ? '' : href}`
      return nextRouter.replace(url)
    },
    back: () => nextRouter.back(),
    forward: () => nextRouter.forward(),
    refresh: () => nextRouter.refresh(),
    prefetch: (href: string) => {
      const url = href.startsWith('http') ? href : `/${locale}${href === '/' ? '' : href}`
      return nextRouter.prefetch(url)
    },
  }
}

/** Link that prepends current locale to internal hrefs */
function LocaleLink({ href, ...rest }: ComponentProps<typeof Link>) {
  const pathname = useNextPathname() ?? ''
  const locale = getLocaleFromPathname(pathname)

  let resolvedHref: ComponentProps<typeof Link>['href']
  if (typeof href === 'string') {
    resolvedHref =
      href.startsWith('#') || href.startsWith('http')
        ? href
        : `/${locale}${href === '/' ? '' : href}`
  } else if (href && typeof href === 'object' && 'pathname' in href) {
    const path = (href as { pathname?: string }).pathname ?? '/'
    resolvedHref = { ...href, pathname: `/${locale}${path === '/' ? '' : path}` } as any
  } else {
    resolvedHref = href
  }

  return <Link href={resolvedHref} {...rest} />
}

export { LocaleLink as Link }

/** Client-only: throws. Use next/navigation redirect() in Server Components. */
export function redirect(_url: string): never {
  throw new Error(
    'redirect() from i18n/navigation is client-only and not supported. Use redirect() from next/navigation in Server Components.'
  )
}
