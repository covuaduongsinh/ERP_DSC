import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ContactInfoSection } from '@/components/contact/ContactInfoSection';
import { ConsultationForm } from '@/components/forms/ConsultationForm';
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
  const t = await getTranslations({ locale, namespace: 'contact' });

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: routes.contact,
    locale,
  });
}

export default async function ContactPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations('contact');
  const payload = await getPayloadClient();

  const { docs: locations } = await payload.find({
    collection: 'locations',
    limit: 10,
    sort: '-isHeadquarters',
  });
  const hq = locations[0];

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <section
        className="bg-white py-16 sm:py-20"
        aria-labelledby="lien-he-tu-van-title"
      >
        <h2 id="lien-he-tu-van-title" className="sr-only">
          {t('formTitle')}
        </h2>
        <div className="mx-auto grid max-w-container items-start gap-8 px-[18px] sm:px-7 min-[860px]:grid-cols-[0.9fr_1.1fr]">
          <ContactInfoSection address={hq?.address} />
          <ConsultationForm locations={locations} id="lien-he-tu-van" showNote />
        </div>
      </section>
    </>
  );
}
