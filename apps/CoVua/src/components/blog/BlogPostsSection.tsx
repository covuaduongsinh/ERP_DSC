import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { PostCard } from '@/components/cards/PostCard';
import { Pagination } from '@/components/ui/Pagination';
import { Reveal } from '@/components/ui/Reveal';
import { Link } from '@/i18n/navigation';
import { formatDate, getPostCategoryLabel } from '@/lib/labels';
import { getMediaAlt, getMediaUrl } from '@/lib/media';
import { POST_CATEGORIES } from '@/lib/posts';
import { routes } from '@/lib/routes';
import type { Post } from '@/payload-types';

type BlogPostsSectionProps = {
  posts: Post[];
  locale: string;
  currentPage: number;
  totalPages: number;
  activeCategory?: Post['category'];
};

const chipBase =
  'inline-flex items-center rounded-pill px-4 py-2 text-sm font-medium transition-colors';
const chipActive = 'bg-navy text-white';
const chipIdle = 'border border-line text-navy hover:bg-navy-soft';

function FeaturedPost({ post, locale }: { post: Post; locale: string }) {
  const coverUrl = getMediaUrl(post.coverImage);
  const cover =
    typeof post.coverImage === 'object' && post.coverImage !== null
      ? post.coverImage
      : null;

  return (
    <Link
      href={`${routes.blog}/${post.slug}`}
      className="group mb-10 grid overflow-hidden rounded-ds-2xl border border-line bg-white transition-shadow duration-200 hover:shadow-ds-lg min-[860px]:grid-cols-2"
    >
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden bg-[linear-gradient(150deg,#33409A,var(--ds-navy-ink))] min-[860px]:aspect-auto">
        {coverUrl && cover ? (
          <Image
            src={coverUrl}
            alt={getMediaAlt(cover, post.title)}
            fill
            sizes="(max-width: 860px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <>
            <BrandPattern variant="white" size={60} opacity={0.1} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/symbol-white.svg"
              alt=""
              aria-hidden
              className="relative w-20 opacity-90"
            />
          </>
        )}
      </div>
      <div className="flex flex-col justify-center p-7 sm:p-9">
        <span className="font-cond text-[12px] font-bold uppercase tracking-[0.08em] text-teal-deep">
          {getPostCategoryLabel(post.category)}
        </span>
        <h3 className="mt-2 text-[clamp(22px,2.4vw,28px)] font-black leading-tight text-ink">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-[#4a4f63]">
            {post.excerpt}
          </p>
        )}
        {post.publishedAt && (
          <time dateTime={post.publishedAt} className="mt-4 text-[13px] text-muted">
            {formatDate(post.publishedAt, locale)}
          </time>
        )}
      </div>
    </Link>
  );
}

export async function BlogPostsSection({
  posts,
  locale,
  currentPage,
  totalPages,
  activeCategory,
}: BlogPostsSectionProps) {
  const t = await getTranslations('blog');

  const showFeatured =
    currentPage === 1 && !activeCategory && posts.length > 0;
  const featured = showFeatured ? posts[0] : null;
  const gridPosts = showFeatured ? posts.slice(1) : posts;

  return (
    <section className="bg-bg py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        {/* Bộ lọc danh mục */}
        <div className="mb-10 flex flex-wrap justify-center gap-2.5">
          <Link
            href={routes.blog}
            className={`${chipBase} ${activeCategory ? chipIdle : chipActive}`}
          >
            {t('filterAll')}
          </Link>
          {POST_CATEGORIES.map((cat) => (
            <Link
              key={cat}
              href={`${routes.blog}?cat=${cat}`}
              className={`${chipBase} ${
                activeCategory === cat ? chipActive : chipIdle
              }`}
            >
              {getPostCategoryLabel(cat)}
            </Link>
          ))}
        </div>

        {posts.length === 0 ? (
          <p className="text-center text-sm text-muted">{t('empty')}</p>
        ) : (
          <>
            {featured && <FeaturedPost post={featured} locale={locale} />}
            {gridPosts.length > 0 && (
              <Reveal className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
                {gridPosts.map((post) => (
                  <PostCard key={post.id} post={post} locale={locale} />
                ))}
              </Reveal>
            )}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              basePath={routes.blog}
              params={{ cat: activeCategory }}
            />
          </>
        )}
      </div>
    </section>
  );
}
