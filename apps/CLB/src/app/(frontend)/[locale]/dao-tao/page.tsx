import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ConsultSection } from '@/components/home/ConsultSection'
import { AgeGroupsSection } from '@/components/training/AgeGroupsSection'
import { TrainingLevelsSection } from '@/components/training/TrainingLevelsSection'
import { PageHero } from '@/components/ui/PageHero'
import { formatRoadmapPath } from '@/lib/roadmap'
import { routes } from '@/lib/routes'
import { buildPageMetadata } from '@/lib/seo'

type Props = {
  params: Promise<{ locale: string }>
}

/** ISR: làm mới nội dung mỗi 1 giờ. */
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'training' })

  return buildPageMetadata({
    title: t('metaTitle'),
    description: t('metaDescription', { roadmap: formatRoadmapPath() }),
    path: routes.training,
    locale,
  })
}

export default async function TrainingPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('training')
  const chips = (t.raw('chips') as string[]).map((label) => ({ label }))

  return (
    <>
      <PageHero
        title={t('title')}
        subtitle={t('subtitle', { roadmap: formatRoadmapPath() })}
        chips={chips}
      />
      <TrainingLevelsSection />
      <AgeGroupsSection />
      <ConsultSection />
    </>
  )
}
