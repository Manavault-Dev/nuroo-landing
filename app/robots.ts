import { MetadataRoute } from 'next'
import { getAbsoluteUrl } from '@/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/private/', '/admin/', '/api/'],
    },
    sitemap: getAbsoluteUrl('/sitemap.xml'),
  }
}
