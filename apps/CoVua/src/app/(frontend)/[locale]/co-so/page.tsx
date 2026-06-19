import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { LocationsSection } from '@/components/locations/LocationsSection';
import { CtaBand } from '@/components/ui/CtaBand';
import { PageHero } from '@/components/ui/PageHero';
import { getPayloadClient } from '@/lib/payload';
import { routes } from '@/lib/routes';
import { buildPageMetadata } from '@/lib/seo';

type Props = {
  params: Promise<{ locale: string }>;
};

/** ISR: làm mới nội dung mỗi 1 giờ. */
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'locations' });

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: routes.locations,
    locale,
  });
}

export default async function LocationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('locations');
  const payload = await getPayloadClient();
  const chips = (t.raw('chips') as string[]).map((label) => ({ label }));

  const { docs: locations } = await payload.find({
    collection: 'locations',
    limit: 10,
    sort: '-isHeadquarters',
  });

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} chips={chips} />
      <LocationsSection locations={locations} />
      <CtaBand />
    </>
  );
}
