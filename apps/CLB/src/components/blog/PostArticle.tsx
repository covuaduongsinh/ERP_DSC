import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { BrandPattern } from '@/components/brand/BrandPattern'
import { ChessPiece } from '@/components/brand/ChessPiece'
import { PostCard } from '@/components/cards/PostCard'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Link } from '@/i18n/navigation'
import { formatDate, getPostCategoryLabel } from '@/lib/labels'
import { getMediaAlt, getMediaUrl } from '@/lib/media'
import { getPostAuthorName } from '@/lib/posts'
import { routes } from '@/lib/routes'
import type { Post } from '@/payload-types'

type PostArticleProps = {
  post: Post
  locale: string
  related?: Post[]
}

export async function PostArticle({ post, locale, related = [] }: PostArticleProps) {
  const t = await getTranslations('blog')
  const coverUrl = getMediaUrl(post.coverImage)
  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null
  const authorName = getPostAuthorName(post.author)

  return (
    <>
      <article className="bg-white pb-16 pt-12 sm:pb-20">
        <div className="mx-auto max-w-container px-[18px] sm:px-7">
          <Link
            href={routes.blog}
            className="inline-flex items-center text-sm font-semibold text-navy transition-colors hover:text-navy-hover"
          >
            ← {t('backToList')}
          </Link>

          <header className="mx-auto mt-8 max-w-[740px] text-center">
            <span className="font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-teal-deep">
              {getPostCategoryLabel(post.category)}
            </span>
            <h1 className="mt-3 text-[clamp(30px,4vw,46px)] font-black leading-[1.1] tracking-[-0.02em] text-ink">
              {post.title}
            </h1>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm text-muted">
              <span className="inline-flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy">
                  <ChessPiece code="wk" className="w-4" />
                </span>
                {authorName}
              </span>
              {post.publishedAt && (
                <>
                  <span aria-hidden className="text-line">
                    ·
                  </span>
                  <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                </>
              )}
            </div>
          </header>

          <div className="relative mx-auto mt-8 flex aspect-[16/7] max-w-4xl items-center justify-center overflow-hidden rounded-ds-2xl bg-[linear-gradient(150deg,var(--ds-primary),var(--ds-navy-ink))]">
            {coverUrl && cover ? (
              <Image
                src={coverUrl}
                alt={getMediaAlt(cover, post.title)}
                fill
                priority
                sizes="(max-width: 896px) 100vw, 896px"
                className="object-cover"
              />
            ) : (
              <>
                <BrandPattern variant="white" size={66} opacity={0.08} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/symbol-white.svg"
                  alt=""
                  aria-hidden
                  className="relative w-24 opacity-90"
                />
              </>
            )}
          </div>

          <div className="mx-auto mt-10 max-w-[740px]">
            {post.excerpt && (
              <p className="mb-6 text-[20px] font-medium leading-relaxed text-ink">
                {post.excerpt}
              </p>
            )}
            <div className="text-[17.5px] leading-[1.8] text-[#2c3142]">
              <RichTextContent data={post.content} variant="article" />
            </div>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-bg py-16 sm:py-20">
          <div className="mx-auto max-w-container px-[18px] sm:px-7">
            <SectionHeading title={t('relatedTitle')} />
            <div className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
              {related.map((item) => (
                <PostCard key={item.id} post={item} locale={locale} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
