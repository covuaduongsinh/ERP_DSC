import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { BlogPostsSection } from '@/components/blog/BlogPostsSection'
import { PageHero } from '@/components/ui/PageHero'
import { getPayloadClient } from '@/lib/payload'
import { parsePostCategory, parsePostsPage, POSTS_PER_PAGE, publishedPostsWhere } from '@/lib/posts'
import { routes } from '@/lib/routes'
import { buildPageMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ page?: string; cat?: string }>
}

/** ISR: làm mới danh sách blog mỗi 1 giờ. */
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'blog' })

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: routes.blog,
    locale,
  })
}

export default async function BlogPage({ params, searchParams }: Props) {
  const { locale } = await params
  const { page: pageParam, cat: catParam } = await searchParams
  setRequestLocale(locale)

  const currentPage = parsePostsPage(pageParam)
  const activeCategory = parsePostCategory(catParam)
  const t = await getTranslations('blog')
  const payload = await getPayloadClient()

  const where = activeCategory
    ? { and: [publishedPostsWhere, { category: { equals: activeCategory } }] }
    : publishedPostsWhere

  const result = await payload.find({
    collection: 'posts',
    limit: POSTS_PER_PAGE,
    page: currentPage,
    depth: 1,
    sort: '-publishedAt',
    where,
  })

  if (currentPage > 1 && result.docs.length === 0) {
    notFound()
  }

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <BlogPostsSection
        posts={result.docs}
        locale={locale}
        currentPage={currentPage}
        totalPages={result.totalPages}
        activeCategory={activeCategory}
      />
    </>
  )
}
