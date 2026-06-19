import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { ChessPiece } from '@/components/brand/ChessPiece';
import { pieceForLevel } from '@/lib/chess';
import { getLevelLabel } from '@/lib/labels';
import { getMediaAlt, getMediaUrl } from '@/lib/media';
import type { FeaturedBook } from '@/payload-types';

type BookCardProps = {
  book: FeaturedBook;
};

export async function BookCard({ book }: BookCardProps) {
  const t = await getTranslations('common');
  const imageUrl = getMediaUrl(book.image);
  const image =
    typeof book.image === 'object' && book.image !== null ? book.image : null;

  return (
    <a
      href={book.sapoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-[18px] rounded-ds-lg border border-line bg-bg p-[18px] transition-[transform,box-shadow] duration-200 ease-ds hover:-translate-y-1 hover:shadow-ds-md"
    >
      <div className="relative flex h-[104px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-[linear-gradient(160deg,var(--ds-blue-light),var(--ds-primary))] shadow-ds-sm">
        {imageUrl && image ? (
          <Image
            src={imageUrl}
            alt={getMediaAlt(image, book.title)}
            fill
            sizes="78px"
            className="object-cover"
          />
        ) : (
          <ChessPiece
            code={pieceForLevel(getLevelLabel(book.level))}
            className="w-12 drop-shadow-[0_4px_8px_rgba(0,0,0,.4)]"
          />
        )}
      </div>
      <div className="min-w-0">
        {book.level && (
          <span className="font-cond text-xs font-bold uppercase tracking-[0.05em] text-teal-deep">
            {t('levelPrefix')} {getLevelLabel(book.level)}
          </span>
        )}
        <h3 className="mt-1 text-base font-bold leading-tight text-ink">
          {book.title}
        </h3>
        {book.shortDesc && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-muted">
            {book.shortDesc}
          </p>
        )}
        <span className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-navy">
          {t('buyNow')} →
        </span>
      </div>
    </a>
  );
}
