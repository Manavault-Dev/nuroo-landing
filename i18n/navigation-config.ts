/**
 * Server-safe locale config and helpers.
 * No React hooks, no browser APIs — safe to import from RSC or middleware.
 */

export const LOCALES = ['en', 'ru', 'ky'] as const
export const DEFAULT_LOCALE = 'en'
export type Locale = (typeof LOCALES)[number]

export function getLocaleFromPathname(pathname: string): Locale {
  const segment = pathname.split('/')[1]
  return segment && LOCALES.includes(segment as Locale) ? (segment as Locale) : DEFAULT_LOCALE
}

/** Strip locale prefix from pathname (e.g. /en/b2b/login -> /b2b/login) */
export function pathnameWithoutLocale(pathname: string): string {
  const locale = getLocaleFromPathname(pathname)
  if (pathname.startsWith(`/${locale}`)) {
    const without = pathname.slice(locale.length + 1)
    return without || '/'
  }
  return pathname || '/'
}
