export const DEFAULT_SITE_URL = 'https://usenuroo.com'

export function getSiteUrl() {
  const rawUrl = process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL

  return rawUrl.replace(/\/+$/, '')
}

export function getSiteHostname() {
  return new URL(getSiteUrl()).hostname.replace(/^www\./, '')
}

export function getAbsoluteUrl(path = '/') {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  return `${getSiteUrl()}${normalizedPath}`
}
