import type { MetadataRoute } from 'next'

const BASE = 'https://usenuroo.com'
const LOCALES = ['ru', 'en', 'ky'] as const

// Only pages that actually exist under app/[locale]/
const PAGES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency']
  priority: number
}> = [
  { path: '', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return LOCALES.flatMap((locale) =>
    PAGES.map(({ path, changeFrequency, priority }) => ({
      url: `${BASE}/${locale}${path}`,
      lastModified: now,
      changeFrequency,
      priority,
    }))
  )
}
