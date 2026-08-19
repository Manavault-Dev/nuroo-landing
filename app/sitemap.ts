import type { MetadataRoute } from 'next'
import { getAbsoluteUrl } from '@/lib/seo/site'

const LOCALES = ['ru', 'en', 'ky'] as const

// Only pages that actually exist under app/[locale]/
const PAGES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']
  priority: number
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/marketplace', changeFrequency: 'daily', priority: 0.95 },
  { path: '/connect', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return LOCALES.flatMap((locale) =>
    PAGES.map(({ path, changeFrequency, priority }) => ({
      url: getAbsoluteUrl(`/${locale}${path}`),
      lastModified: now,
      changeFrequency,
      priority,
    }))
  )
}
