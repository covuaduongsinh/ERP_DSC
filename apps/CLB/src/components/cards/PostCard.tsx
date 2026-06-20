import Image from 'next/image'
import { BrandPattern } from '@/components/brand/BrandPattern'
import { Link } from '@/i18n/navigation'
import { formatDate, getPostCategoryLabel } from '@/lib/labels'
import { getMediaAlt, getMediaUrl } from '@/lib/media'
import { routes } from '@/lib/routes'
import type { Post } from '@/payload-types'

type PostCardProps = {
  post: Post
  locale: string
}

export function PostCard({ post, locale }: PostCardProps) {
  const coverUrl = getMediaUrl(post.coverImage)
  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null ? post.coverImage : null

  return (
    <Link
      href={`${routes.blog}/${post.slug}`}
      className="group flex flex-col overflow-hidden rounded-ds-lg border border-line bg-white transition-[transform,box-shadow] duration-200 ease-ds hover:-translate-y-1 hover:shadow-ds-md"
    >
      <div className="relative flex aspect-[16/9] items-center justify-center overflow-hidden bg-[linear-gradient(150deg,#33409A,var(--ds-navy-ink))]">
        {coverUrl && cover ? (
          <Image
            src={coverUrl}
            alt={getMediaAlt(cover, post.title)}
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className="object-cover"
          />
        ) : (
          <>
            <BrandPattern variant="white" size={54} opacity={0.1} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/symbol-white.svg"
              alt=""
              aria-hidden
              className="relative w-[54px] opacity-90"
            />
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className="font-cond text-[11.5px] font-bold uppercase tracking-[0.08em] text-teal-deep">
          {getPostCategoryLabel(post.category)}
        </span>
        <h3 className="mt-2 line-clamp-2 text-[17px] font-bold leading-snug text-ink">
          {post.title}
        </h3>
        {post.publishedAt && (
          <time dateTime={post.publishedAt} className="mt-3 text-[13px] text-muted">
            {formatDate(post.publishedAt, locale)}
          </time>
        )}
      </div>
    </Link>
  )
}
