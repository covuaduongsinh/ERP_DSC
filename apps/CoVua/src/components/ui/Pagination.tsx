import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  basePath: string;
  /** Query bổ sung giữ lại khi đổi trang (ví dụ ?cat=...) */
  params?: Record<string, string | undefined>;
};

function buildHref(
  basePath: string,
  page: number,
  params?: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) sp.set(key, value);
  }
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function getVisiblePages(currentPage: number, totalPages: number): number[] {
  const maxVisible = 5;
  let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  const end = Math.min(totalPages, start + maxVisible - 1);
  start = Math.max(1, end - maxVisible + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

const navItem =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-pill px-3.5 text-sm font-medium transition-colors';
const navLink = `${navItem} border border-line text-navy hover:border-navy/40 hover:bg-navy-soft`;
const navDisabled = `${navItem} border border-line text-muted opacity-50`;

export async function Pagination({
  currentPage,
  totalPages,
  basePath,
  params,
}: PaginationProps) {
  const t = await getTranslations('blog');

  if (totalPages <= 1) {
    return null;
  }

  const pages = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      aria-label={t('paginationLabel')}
      className="mt-12 flex flex-wrap items-center justify-center gap-2"
    >
      {currentPage > 1 ? (
        <Link href={buildHref(basePath, currentPage - 1, params)} className={navLink}>
          {t('paginationPrev')}
        </Link>
      ) : (
        <span className={navDisabled}>{t('paginationPrev')}</span>
      )}

      {pages.map((page) =>
        page === currentPage ? (
          <span
            key={page}
            aria-current="page"
            className={`${navItem} bg-navy font-bold text-white`}
          >
            {page}
          </span>
        ) : (
          <Link key={page} href={buildHref(basePath, page, params)} className={navLink}>
            {page}
          </Link>
        ),
      )}

      {currentPage < totalPages ? (
        <Link href={buildHref(basePath, currentPage + 1, params)} className={navLink}>
          {t('paginationNext')}
        </Link>
      ) : (
        <span className={navDisabled}>{t('paginationNext')}</span>
      )}
    </nav>
  );
}
