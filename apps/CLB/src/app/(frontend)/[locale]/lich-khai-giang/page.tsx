import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ClubScheduleSection } from '@/components/schedule/ClubScheduleSection'
import { OpenClassesSection } from '@/components/schedule/OpenClassesSection'
import { UpcomingEventsSection } from '@/components/schedule/OpeningScheduleSections'
import { CtaBand } from '@/components/ui/CtaBand'
import { PageHero } from '@/components/ui/PageHero'
import { getPayloadClient } from '@/lib/payload'
import { routes } from '@/lib/routes'
import { buildPageMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
}

/** ISR: làm mới nội dung mỗi 1 giờ. */
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'schedule' })

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription'),
    path: routes.openingSchedule,
    locale,
  })
}

export default async function OpeningSchedulePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('schedule')
  const payload = await getPayloadClient()
  const now = new Date().toISOString()

  const { docs: events } = await payload.find({
    collection: 'events',
    limit: 50,
    depth: 1,
    sort: 'date',
    where: {
      date: {
        greater_than_equal: now,
      },
    },
  })

  return (
    <>
      <PageHero title={t('title')} subtitle={t('subtitle')} />
      <UpcomingEventsSection events={events} locale={locale} />
      <OpenClassesSection variant="page" />
      <ClubScheduleSection />
      <CtaBand />
    </>
  )
}
