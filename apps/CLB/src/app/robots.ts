import type { MetadataRoute } from 'next'
import { getSiteUrl } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/', '/cong-phu-huynh/', '/en/cong-phu-huynh/'],
    },
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  }
}
