import { brand } from '@ds/brand';
import { getTranslations } from 'next-intl/server';
import {
  BuildingIcon,
  FacebookIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
} from '@/components/ui/icons';
import type { ComponentType, ReactNode, SVGProps } from 'react';

type ContactInfoSectionProps = {
  /** Địa chỉ trụ sở (lấy từ Locations) */
  address?: string;
};

type Row = {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: ReactNode;
};

/** Thẻ thông tin liên hệ (5 dòng icon navy trong ô navy-soft). */
export async function ContactInfoSection({ address }: ContactInfoSectionProps) {
  const t = await getTranslations('contact');

  const facebookUrl = brand.facebook.startsWith('http')
    ? brand.facebook
    : `https://${brand.facebook}`;
  const hotlineHref = `tel:${brand.hotline.replace(/\./g, '')}`;

  const rows: Row[] = [
    { icon: BuildingIcon, label: t('company'), value: brand.fullName },
    {
      icon: PhoneIcon,
      label: t('hotline'),
      value: (
        <a href={hotlineHref} className="font-semibold text-navy hover:text-navy-hover">
          {brand.hotline}
        </a>
      ),
    },
    {
      icon: MailIcon,
      label: t('email'),
      value: (
        <a
          href={`mailto:${brand.email}`}
          className="break-all font-semibold text-navy hover:text-navy-hover"
        >
          {brand.email}
        </a>
      ),
    },
    {
      icon: FacebookIcon,
      label: t('facebook'),
      value: (
        <a
          href={facebookUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-navy hover:text-navy-hover"
        >
          {brand.facebook}
        </a>
      ),
    },
    {
      icon: PinIcon,
      label: t('locations'),
      value: <span className="whitespace-pre-line">{address ?? brand.domains.hub}</span>,
    },
  ];

  return (
    <div className="rounded-ds-2xl border border-line bg-white p-7 shadow-ds-sm sm:p-8">
      <h2 className="text-[22px] font-black text-ink">{t('infoTitle')}</h2>
      <p className="mt-1.5 text-sm text-muted">{t('infoSubtitle')}</p>

      <dl className="mt-7 flex flex-col gap-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ds-md bg-navy-soft text-navy">
              <row.icon className="w-[22px]" />
            </span>
            <div className="min-w-0">
              <dt className="font-cond text-[12px] font-bold uppercase tracking-[0.08em] text-muted">
                {row.label}
              </dt>
              <dd className="mt-0.5 text-[15px] text-ink">{row.value}</dd>
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-7 border-t border-line pt-5 text-sm italic text-navy">
        {brand.slogan} — {brand.tagline}
      </p>
    </div>
  );
}
