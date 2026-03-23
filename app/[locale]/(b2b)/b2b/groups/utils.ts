import type { TimeT } from './types'

export const PRESET_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f59e0b',
  '#10b981',
  '#3b82f6',
  '#ef4444',
  '#14b8a6',
]

export function relativeTime(iso: string, t: TimeT, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return t('timeJustNow')
  if (mins < 60) return t('timeMinutesAgo', { n: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('timeHoursAgo', { n: hours })
  const days = Math.floor(hours / 24)
  if (days === 1) return t('timeYesterday')
  if (days < 30) return t('timeDaysAgo', { n: days })
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function formatDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long' })
}

export function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export function pluralChildren(n: number, t: TimeT): string {
  return t('childrenCount', { n })
}
