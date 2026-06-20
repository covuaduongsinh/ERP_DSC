import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsultSection } from '@/components/home/ConsultSection'
import { FeaturedBooksSection } from '@/components/home/FeaturedBooksSection'
import { HeroSection } from '@/components/home/HeroSection'
import { LatestPostsSection } from '@/components/home/LatestPostsSection'
import { RoadmapSection } from '@/components/home/RoadmapSection'
import { ClubScheduleSection } from '@/components/schedule/ClubScheduleSection'
import { OpenClassesSection } from '@/components/schedule/OpenClassesSection'
import { formatRoadmapPath } from '@/lib/roadmap'
import { routes } from '@/lib/routes'
import { buildPageMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
}

/** ISR: làm mới nội dung trang chủ (kể cả sách nổi bật) mỗi 1 giờ. */
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription', { roadmap: formatRoadmapPath() }),
    path: routes.home,
    locale,
    absoluteTitle: true,
  })
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  return (
    <>
      <HeroSection />
      <RoadmapSection />
      <OpenClassesSection variant="home" />
      <ClubScheduleSection variant="home" />
      <FeaturedBooksSection />
      <LatestPostsSection locale={locale} />
      <ConsultSection />
    </>
  )
}
