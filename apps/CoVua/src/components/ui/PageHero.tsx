import { getTranslations } from 'next-intl/server';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { ChessPiece } from '@/components/brand/ChessPiece';
import { Link } from '@/i18n/navigation';
import type { PieceCode } from '@/lib/chess';
import { routes } from '@/lib/routes';

export type HeroChip = { piece?: PieceCode; label: string };

type PageHeroProps = {
  title: string;
  /** Đoạn lead dưới tiêu đề */
  subtitle?: string;
  /** Chip kính mờ (tuỳ chọn) */
  chips?: HeroChip[];
};

/**
 * Dải hero đầu trang phụ: gradient navy, breadcrumb (Trang chủ › Tên trang), H1,
 * lead, và hàng chip kính mờ tuỳ chọn. Tham chiếu `.phero` của design.
 */
export async function PageHero({ title, subtitle, chips }: PageHeroProps) {
  const tNav = await getTranslations('nav');

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(160deg,var(--ds-primary),var(--ds-navy-ink))] text-white">
      <BrandPattern variant="white" size={66} opacity={0.05} />
      {/* Quầng sáng teal góc trên phải */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-52 h-[520px] w-[520px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(61,187,149,.18), transparent 68%)',
        }}
      />
      {/* Vương miện mờ góc dưới phải */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/symbol-white.svg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -right-8 w-[230px] opacity-10"
      />

      <div className="relative z-[1] mx-auto max-w-container px-[18px] pb-14 pt-12 sm:px-7">
        <nav
          aria-label="Breadcrumb"
          className="mb-4 flex items-center gap-2 text-[13px] text-white/[.62]"
        >
          <Link href={routes.home} className="transition-colors hover:text-white">
            {tNav('home')}
          </Link>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
            className="opacity-60"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span aria-current="page" className="text-white">
            {title}
          </span>
        </nav>

        <h1 className="max-w-3xl font-sans text-[clamp(30px,3.6vw,46px)] font-black leading-[1.08] tracking-[-0.02em]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3.5 max-w-[600px] text-[18px] leading-relaxed text-white/[.82]">
            {subtitle}
          </p>
        )}

        {chips && chips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2.5">
            {chips.map((chip) => (
              <span
                key={chip.label}
                className="inline-flex items-center gap-2 rounded-pill border border-white/[.16] bg-white/[.08] px-3.5 py-[7px] text-[13.5px] text-white/[.92]"
              >
                {chip.piece && (
                  <ChessPiece code={chip.piece} className="h-[18px] w-[18px]" />
                )}
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
