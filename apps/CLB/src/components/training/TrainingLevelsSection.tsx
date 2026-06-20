import { brand } from '@ds/brand'
import { getTranslations } from 'next-intl/server'
import { ChessPiece } from '@/components/brand/ChessPiece'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { pieceForLevel } from '@/lib/chess'
import { getLevelLabel } from '@/lib/labels'
import { getTrackForLevel, trackOrder } from '@/lib/roadmap'
import { levelOrder } from '@/lib/training'

export async function TrainingLevelsSection() {
  const t = await getTranslations('training')
  const total = brand.roadmap.length

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading title={t('levelsTitle', { count: total })} subtitle={t('levelsSubtitle')} />

        <div className="flex flex-col gap-12">
          {trackOrder.map((track) => {
            const levels = levelOrder.filter((level) => getTrackForLevel(level) === track)
            if (levels.length === 0) return null

            return (
              <div key={track}>
                <div className="mb-6 max-w-[680px]">
                  <h3 className="font-cond text-[22px] font-black text-navy">
                    {t(`tracks.${track}`)}
                  </h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-muted">
                    {t(`trackDesc.${track}`)}
                  </p>
                </div>

                <Reveal className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
                  {levels.map((level) => {
                    // Giữ thứ tự bước TOÀN CỤC (1..6) theo levelOrder — không reset mỗi tuyến.
                    const stepIndex = levelOrder.indexOf(level)
                    const name = getLevelLabel(level)
                    const isLast = stepIndex === levelOrder.length - 1
                    return (
                      <article
                        key={level}
                        className="relative overflow-hidden rounded-ds-xl border border-line bg-white p-6 transition-shadow duration-200 hover:shadow-ds-md"
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute right-1 top-1 font-cond text-[64px] font-black leading-none text-navy-soft"
                        >
                          {stepIndex + 1}
                        </span>
                        <div
                          className={`relative flex h-[58px] w-[58px] items-center justify-center rounded-[14px] ${
                            isLast ? 'bg-teal' : 'bg-navy'
                          }`}
                        >
                          <ChessPiece code={pieceForLevel(name)} className="w-9" />
                        </div>
                        <p className="relative mt-4 font-cond text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
                          {t('stepOf', { current: stepIndex + 1, total })}
                        </p>
                        <h3 className="relative mt-1 font-cond text-[26px] font-black leading-tight text-navy">
                          {name}
                        </h3>
                        <p className="relative mt-2.5 text-[15px] leading-relaxed text-[#4a4f63]">
                          {t(`levels.${level}`)}
                        </p>
                      </article>
                    )
                  })}
                </Reveal>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
