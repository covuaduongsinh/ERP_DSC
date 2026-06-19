import { brand } from '@ds/brand';
import { getTranslations } from 'next-intl/server';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { BrandPattern } from '@/components/brand/BrandPattern';
import { Link } from '@/i18n/navigation';
import { getPayloadClient } from '@/lib/payload';
import { routes } from '@/lib/routes';
import type { Location } from '@/payload-types';

const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);
const MailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
);
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path d="M12 21s-7-5.2-7-11a7 7 0 1 1 14 0c0 5.8-7 11-7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const tNav = await getTranslations('nav');
  const payload = await getPayloadClient();

  const { docs: locations } = await payload.find({
    collection: 'locations',
    limit: 3,
    sort: '-isHeadquarters',
  });

  const hq = locations[0] as Location | undefined;
  const facebookUrl = brand.facebook.startsWith('http')
    ? brand.facebook
    : `https://${brand.facebook}`;

  const exploreLinks = [
    { href: routes.training, label: tNav('training') },
    { href: routes.openingSchedule, label: tNav('openingSchedule') },
    { href: routes.coaches, label: tNav('coaches') },
    { href: routes.blog, label: tNav('blog') },
  ];

  return (
    <footer className="relative mt-auto overflow-hidden bg-navy-ink text-white/70">
      <BrandPattern variant="white" size={80} opacity={0.05} />
      <div className="relative z-[1] mx-auto max-w-container px-[18px] pb-7 pt-16 sm:px-7">
        <div className="grid gap-10 border-b border-white/[.12] pb-9 sm:grid-cols-2 min-[860px]:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <BrandLogo variant="white" className="mb-4 h-[50px] w-auto" />
            <p className="text-sm leading-[1.7]">{t('tagline')}</p>
          </div>

          <div>
            <h2 className="mb-4 font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-white">
              {t('explore')}
            </h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {exploreLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-teal">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-white">
              {tNav('locations')}
            </h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {locations.length > 0 ? (
                locations.map((loc: Location) => (
                  <li key={loc.id}>
                    <Link
                      href={routes.locations}
                      className="transition-colors hover:text-teal"
                    >
                      {loc.name}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <Link href={routes.locations} className="hover:text-teal">
                    {tNav('locations')}
                  </Link>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 font-cond text-[13px] font-bold uppercase tracking-[0.1em] text-white">
              {t('contact')}
            </h2>
            <a
              href={`tel:${brand.hotline.replace(/\./g, '')}`}
              className="mb-3.5 flex items-start gap-2.5 text-sm transition-colors hover:text-teal"
            >
              <span className="mt-0.5 w-[17px] shrink-0 text-teal">
                <PhoneIcon />
              </span>
              {brand.hotline}
            </a>
            <a
              href={`mailto:${brand.email}`}
              className="mb-3.5 flex items-start gap-2.5 break-all text-sm transition-colors hover:text-teal"
            >
              <span className="mt-0.5 w-[17px] shrink-0 text-teal">
                <MailIcon />
              </span>
              {brand.email}
            </a>
            <div className="flex items-start gap-2.5 text-sm">
              <span className="mt-0.5 w-[17px] shrink-0 text-teal">
                <PinIcon />
              </span>
              <span>{hq?.address ?? t('addressPending')}</span>
            </div>
            <a
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3.5 inline-block text-sm transition-colors hover:text-teal"
            >
              {brand.facebook}
            </a>
          </div>
        </div>

        <div className="relative flex flex-wrap justify-between gap-2 pt-6 text-[13px] text-white/50">
          <span>
            © {new Date().getFullYear()} {brand.fullName}
          </span>
          <span>
            {brand.slogan} · {brand.domains.hub}
          </span>
        </div>
      </div>
    </footer>
  );
}
