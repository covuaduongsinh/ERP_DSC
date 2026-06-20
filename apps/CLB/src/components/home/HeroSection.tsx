import { brand, Logo } from '@ds/brand'
import { getTranslations } from 'next-intl/server'
import { BrandPattern } from '@/components/brand/BrandPattern'
import { ChessBoard } from '@/components/brand/ChessBoard'
import { ChessPiece } from '@/components/brand/ChessPiece'
import { buttonClass } from '@/components/ui/Button'
import { Overline } from '@/components/ui/Overline'
import { Link } from '@/i18n/navigation'
import { routes } from '@/lib/routes'

const trustLabelClass = 'flex items-center gap-2.5 text-sm font-medium text-[#4a4f63]'

export async function HeroSection() {
  const t = await getTranslations('home')
  const firstPiece = brand.roadmap[0].piece
  const lastPiece = brand.roadmap[brand.roadmap.length - 1].piece

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(1100px 480px at 78% -8%, rgba(43,57,144,.07), transparent 60%), var(--ds-bg)',
      }}
    >
      <BrandPattern variant="navy" size={64} opacity={0.04} />
      <div className="relative z-[1] mx-auto grid max-w-container items-center gap-11 px-[18px] py-14 sm:px-7 min-[860px]:grid-cols-[1.08fr_.92fr] min-[860px]:gap-14 min-[860px]:py-[84px]">
        {/* Cột chữ */}
        <div className="text-center min-[860px]:text-left">
          <Overline className="hero-rise hero-rise-1 inline-block">{t('heroOverline')}</Overline>
          <h1 className="hero-rise hero-rise-2 mt-4 text-[clamp(38px,4.4vw,60px)] font-black leading-[1.05] tracking-[-0.02em] text-navy">
            {t('heroTitle')} <em className="not-italic text-teal-deep">{t('heroTitleEm')}</em>
          </h1>
          <p className="hero-rise hero-rise-3 mx-auto mt-5 max-w-[500px] text-[19px] leading-[1.65] text-[#4a4f63] min-[860px]:mx-0">
            {t('heroSubtitle')}
          </p>
          <div className="hero-rise hero-rise-4 mt-7 flex flex-wrap justify-center gap-3.5 min-[860px]:justify-start">
            <Link
              href={{ pathname: routes.home, hash: 'tu-van' }}
              className={buttonClass('primary', 'lg')}
            >
              {t('heroCtaTrial')}
            </Link>
            <Link href={routes.training} className={buttonClass('ghost', 'lg')}>
              {t('roadmapCta')}
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-x-7 gap-y-4 min-[860px]:justify-start">
            <div className={trustLabelClass}>
              <b className="font-cond text-[26px] font-black leading-none text-navy">
                {brand.roadmap.length}
              </b>
              <span>{t('trustLevelsLabel')}</span>
            </div>
            <div className={trustLabelClass}>
              <span className="h-[7px] w-[7px] rounded-full bg-teal" aria-hidden />
              <span>{t('trustSmallClass')}</span>
            </div>
            <div className={trustLabelClass}>
              <span className="h-[7px] w-[7px] rounded-full bg-teal" aria-hidden />
              <span>{t('trustBranches')}</span>
            </div>
          </div>
        </div>

        {/* Cột bàn cờ (ẩn ở mobile) */}
        <div className="hero-art-rise relative hidden justify-self-center min-[860px]:block">
          <ChessBoard />
          <div className="absolute -left-6 top-8 flex items-center gap-3 rounded-ds-lg bg-white px-[18px] py-3.5 shadow-ds-lg">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-navy-soft">
              <Logo variant="symbol" className="h-6 w-6" />
            </span>
            <span className="text-xs leading-[1.3] text-muted">
              <b className="block text-sm text-ink">{brand.slogan}</b>
              {t('heroBadgePhilosophy')}
            </span>
          </div>
          <div className="absolute -right-5 bottom-8 flex items-center gap-3 rounded-ds-lg bg-white px-[18px] py-3.5 shadow-ds-lg">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-navy-soft">
              <ChessPiece code="wq" className="h-6 w-6" />
            </span>
            <span className="text-xs leading-[1.3] text-muted">
              <b className="block text-sm text-ink">
                {firstPiece} → {lastPiece}
              </b>
              {t('heroBadgeRoadmap')}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
