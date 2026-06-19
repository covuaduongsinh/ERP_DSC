import { getTranslations } from 'next-intl/server';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { buttonClass } from '@/components/ui/Button';
import { Link } from '@/i18n/navigation';
import { routes } from '@/lib/routes';

/** Dải CTA navy bo góc, căn giữa → trang Liên hệ. Dùng cuối các trang phụ. */
export async function CtaBand() {
  const t = await getTranslations('cta');

  return (
    <section className="bg-bg py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <div className="relative overflow-hidden rounded-ds-2xl bg-[linear-gradient(135deg,var(--ds-primary),var(--ds-navy-ink))] px-6 py-12 text-center text-white sm:px-12 sm:py-14">
          <BrandPattern variant="white" size={66} opacity={0.06} />
          <h2 className="relative mx-auto max-w-2xl text-[clamp(24px,2.6vw,34px)] font-black leading-[1.15] tracking-[-0.01em]">
            {t('title')}
          </h2>
          <p className="relative mx-auto mt-3.5 max-w-xl text-[16px] leading-relaxed text-white/[.82]">
            {t('desc')}
          </p>
          <div className="relative mt-7">
            <Link href={routes.contact} className={buttonClass('onnavy', 'lg')}>
              {t('button')}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
