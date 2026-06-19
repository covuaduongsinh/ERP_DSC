import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CoachesSection } from '@/components/coaches/CoachesSection';
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
  const t = await getTranslations({ locale, namespace: 'coaches' });

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: routes.coaches,
    locale,
  });
}

export default async function CoachesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('coaches');
  const payload = await getPayloadClient();

  const [{ docs: coaches }, { totalDocs: branchCount }] = await Promise.all([
    payload.find({
      collection: 'web-coaches',
      limit: 50,
      depth: 1,
      sort: 'order',
    }),
    payload.find({
      collection: 'web-locations',
      limit: 0,
      depth: 0,
    }),
  ]);

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <CoachesSection coaches={coaches} branchCount={branchCount} />
      <CtaBand />
    </>
  );
}
