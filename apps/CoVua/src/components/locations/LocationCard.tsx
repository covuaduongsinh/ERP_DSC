import { getTranslations } from 'next-intl/server';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { buttonClass } from '@/components/ui/Button';
import { PhoneIcon, PinIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { getDirectionsUrl, getMapEmbedSrc } from '@/lib/maps';
import { routes } from '@/lib/routes';
import type { Location } from '@/payload-types';

type LocationCardProps = {
  location: Location;
  /** Đảo cột (map sang phải) cho hiệu ứng xen kẽ trái/phải */
  reverse?: boolean;
};

export async function LocationCard({ location, reverse }: LocationCardProps) {
  const t = await getTranslations('locations');
  const tCommon = await getTranslations('common');
  const mapSrc = getMapEmbedSrc(location);
  const directions = getDirectionsUrl(location);
  const phoneHref = location.phone
    ? `tel:${location.phone.replace(/[\s.]/g, '')}`
    : null;

  return (
    <div className="grid items-stretch overflow-hidden rounded-ds-2xl border border-line bg-white shadow-ds-sm min-[860px]:grid-cols-2">
      <div
        className={`relative min-h-[260px] ${reverse ? 'min-[860px]:order-2' : ''}`}
      >
        {mapSrc ? (
          <iframe
            title={t('mapTitle', { name: location.name })}
            src={mapSrc}
            className="h-full min-h-[260px] w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        ) : (
          <div className="relative flex h-full min-h-[260px] flex-col items-center justify-center overflow-hidden bg-[linear-gradient(150deg,var(--ds-primary),var(--ds-navy-ink))]">
            <BrandPattern variant="white" size={54} opacity={0.08} />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/[.12] text-teal ring-1 ring-white/20">
              <PinIcon className="w-7" />
            </span>
            <span className="relative mt-4 text-[12.5px] text-white/60">
              {t('mapPlaceholder')}
            </span>
          </div>
        )}
      </div>

      <div
        className={`flex flex-col justify-center p-7 sm:p-9 ${reverse ? 'min-[860px]:order-1' : ''}`}
      >
        <span
          className={`inline-flex w-fit items-center rounded-pill px-3 py-1 font-cond text-xs font-bold uppercase tracking-wide ${
            location.isHeadquarters
              ? 'bg-teal-soft text-teal-deep'
              : 'bg-navy-soft text-navy'
          }`}
        >
          {location.isHeadquarters ? t('headquarters') : t('branch')}
        </span>
        <h2 className="mt-3 text-[24px] font-black text-navy">{location.name}</h2>

        <div className="mt-4 flex flex-col gap-3">
          <p className="flex items-start gap-2.5 text-sm leading-relaxed text-[#4a4f63]">
            <PinIcon className="mt-0.5 w-[18px] shrink-0 text-teal-deep" />
            <span className="whitespace-pre-line">{location.address}</span>
          </p>
          {location.phone && phoneHref && (
            <a
              href={phoneHref}
              className="flex items-center gap-2.5 text-sm text-[#4a4f63] transition-colors hover:text-navy"
            >
              <PhoneIcon className="w-[18px] shrink-0 text-teal-deep" />
              <span className="font-semibold">{location.phone}</span>
            </a>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={routes.contact} className={buttonClass('ghost', 'sm')}>
            {t('contactCta')}
          </Link>
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass('primary', 'sm')}
          >
            {tCommon('directions')}
          </a>
        </div>
      </div>
    </div>
  );
}
