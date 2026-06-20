import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { PostArticle } from '@/components/blog/PostArticle'
import { routing } from '@/i18n/routing'
import { getMediaUrl } from '@/lib/media'
import { getPayloadClient } from '@/lib/payload'
import { publishedPostsWhere } from '@/lib/posts'
import { buildPageMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string; slug: string }>
}

/** ISR: làm mới bài blog mỗi 1 giờ. */
export const revalidate = 3600

export async function generateStaticParams() {
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: 'posts',
    limit: 500,
    depth: 0,
    where: publishedPostsWhere,
    select: {
      slug: true,
    },
  })

  return routing.locales.flatMap((locale) =>
    docs.map((post) => ({
      locale,
      slug: post.slug,
    })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: 'posts',
    limit: 1,
    depth: 1,
    where: {
      and: [publishedPostsWhere, { slug: { equals: slug } }],
    },
  })

  const post = docs[0]

  if (!post) {
    return {}
  }

  const title = post.seo?.metaTitle || post.title
  const description = post.seo?.metaDescription || post.excerpt || ''
  const coverUrl = getMediaUrl(post.coverImage)

  return buildPageMetadata({
    title,
    description,
    path: `/blog/${slug}`,
    locale,
    image: coverUrl,
    type: 'article',
    publishedTime: post.publishedAt ?? undefined,
    absoluteTitle: true,
  })
}

export default async function BlogPostPage({ params }: Props) {
  const { locale, slug } = await params
  setRequestLocale(locale)

  const payload = await getPayloadClient()

  const { docs } = await payload.find({
    collection: 'posts',
    limit: 1,
    depth: 2,
    where: {
      and: [publishedPostsWhere, { slug: { equals: slug } }],
    },
  })

  const post = docs[0]

  if (!post) {
    notFound()
  }

  const { docs: related } = await payload.find({
    collection: 'posts',
    limit: 3,
    depth: 1,
    sort: '-publishedAt',
    where: {
      and: [
        publishedPostsWhere,
        { category: { equals: post.category } },
        { id: { not_equals: post.id } },
      ],
    },
  })

  return <PostArticle post={post} locale={locale} related={related} />
}
