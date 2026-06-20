import type { MetadataRoute } from 'next'
import { routing } from '@/i18n/routing'
import { routes } from '@/lib/routes'
import { getPayloadClient } from '@/lib/payload'
import { publishedPostsWhere } from '@/lib/posts'
import { getLocalizedPath, getSiteUrl } from '@/lib/seo'

const staticPaths = Object.values(routes)

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getSiteUrl()
  const payload = await getPayloadClient()

  const { docs: posts } = await payload.find({
    collection: 'posts',
    limit: 500,
    depth: 0,
    where: publishedPostsWhere,
    select: {
      slug: true,
      updatedAt: true,
    },
  })

  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
    for (const path of staticPaths) {
      const localizedPath = getLocalizedPath(path, locale)

      entries.push({
        url: `${baseUrl}${localizedPath || ''}`,
        lastModified: new Date(),
        changeFrequency: path === routes.home ? 'weekly' : 'monthly',
        priority: path === routes.home ? 1 : 0.8,
      })
    }

    for (const post of posts) {
      const localizedPath = getLocalizedPath(`/blog/${post.slug}`, locale)

      entries.push({
        url: `${baseUrl}${localizedPath}`,
        lastModified: post.updatedAt ? new Date(post.updatedAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.6,
      })
    }
  }

  return entries
}
