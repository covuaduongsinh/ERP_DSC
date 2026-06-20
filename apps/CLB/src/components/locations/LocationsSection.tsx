import { getTranslations } from 'next-intl/server'
import { LocationCard } from '@/components/locations/LocationCard'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { Location } from '@/payload-types'

type LocationsSectionProps = {
  locations: Location[]
}

export async function LocationsSection({ locations }: LocationsSectionProps) {
  const t = await getTranslations('locations')

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading title={t('listTitle')} subtitle={t('listSubtitle')} />

        {locations.length === 0 ? (
          <p className="text-center text-sm text-muted">{t('empty')}</p>
        ) : (
          <div className="flex flex-col gap-8 sm:gap-10">
            {locations.map((location, i) => (
              <Reveal key={location.id}>
                <LocationCard location={location} reverse={i % 2 === 1} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
