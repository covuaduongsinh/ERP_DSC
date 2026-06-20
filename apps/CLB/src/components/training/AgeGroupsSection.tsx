import { getTranslations } from 'next-intl/server'
import { ChessPiece } from '@/components/brand/ChessPiece'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { PieceCode } from '@/lib/chess'
import { getAgeGroupLabel } from '@/lib/labels'
import { ageGroupOrder, type AgeGroup } from '@/lib/training'

const AGE_PIECE: Record<AgeGroup, PieceCode> = {
  mam_non_4_6: 'wp',
  cap_1_cap_2: 'wr',
}

export async function AgeGroupsSection() {
  const t = await getTranslations('training')

  return (
    <section className="bg-bg py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading overline={t('ageGroupsTitle')} title={t('ageGroupsSubtitle')} />
        <Reveal className="grid gap-6 sm:grid-cols-2">
          {ageGroupOrder.map((ageGroup) => (
            <article
              key={ageGroup}
              className="flex items-start gap-5 rounded-ds-xl border border-line bg-white p-6 transition-shadow duration-200 hover:shadow-ds-md"
            >
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-ds-lg bg-[linear-gradient(150deg,var(--ds-primary),var(--ds-navy-deep))]">
                <ChessPiece code={AGE_PIECE[ageGroup]} className="w-9" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-ink">{getAgeGroupLabel(ageGroup)}</h3>
                  <span className="rounded-pill bg-navy-soft px-2.5 py-0.5 font-cond text-xs font-bold uppercase tracking-wide text-navy">
                    {t(`ageRanges.${ageGroup}`)}
                  </span>
                </div>
                <p className="mt-2 text-[15px] leading-relaxed text-[#4a4f63]">
                  {t(`ageGroups.${ageGroup}`)}
                </p>
              </div>
            </article>
          ))}
        </Reveal>
      </div>
    </section>
  )
}
