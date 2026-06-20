import { brand } from '@ds/brand'
import Image from 'next/image'
import { getTranslations } from 'next-intl/server'
import { BrandPattern } from '@/components/brand/BrandPattern'
import { ChessPiece } from '@/components/brand/ChessPiece'
import { Reveal } from '@/components/ui/Reveal'
import { RichTextContent } from '@/components/ui/RichTextContent'
import { SectionHeading } from '@/components/ui/SectionHeading'
import type { PieceCode } from '@/lib/chess'
import { getMediaAlt, getMediaUrl } from '@/lib/media'
import type { WebCoach } from '@/payload-types'

type CoachesSectionProps = {
  coaches: WebCoach[]
  branchCount: number
}

const PROFILE_PIECES: PieceCode[] = ['wn', 'wb', 'wr', 'wq', 'wk', 'wp']

export async function CoachesSection({ coaches, branchCount }: CoachesSectionProps) {
  const t = await getTranslations('coaches')
  const tCommon = await getTranslations('common')

  const stats = [
    { value: String(coaches.length), label: t('stats.coachesLabel') },
    { value: t('stats.classSize'), label: t('stats.classSizeLabel') },
    { value: String(brand.roadmap.length), label: t('stats.levelsLabel') },
    { value: String(branchCount), label: t('stats.branchesLabel') },
  ]

  return (
    <>
      {coaches.length > 0 && (
        <section className="bg-bg py-12 sm:py-14">
          <div className="mx-auto max-w-container px-[18px] sm:px-7">
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className="text-center">
                  <dt className="font-cond text-[clamp(26px,4vw,46px)] font-black leading-none text-navy">
                    {s.value}
                  </dt>
                  <dd className="mt-2 text-sm text-muted">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-container px-[18px] sm:px-7">
          <SectionHeading title={t('listTitle')} subtitle={t('listSubtitle')} />

          {coaches.length === 0 ? (
            <p className="text-center text-sm text-muted">{t('empty')}</p>
          ) : (
            <Reveal as="ul" className="grid gap-6 min-[560px]:grid-cols-2 min-[860px]:grid-cols-3">
              {coaches.map((coach, i) => {
                const photoUrl = getMediaUrl(coach.photo)
                const photo =
                  typeof coach.photo === 'object' && coach.photo !== null ? coach.photo : null
                return (
                  <li
                    key={coach.id}
                    className="flex flex-col overflow-hidden rounded-ds-xl border border-line bg-white transition-shadow duration-200 hover:shadow-ds-lg"
                  >
                    <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[linear-gradient(150deg,var(--ds-primary),var(--ds-navy-deep))]">
                      {photoUrl && photo ? (
                        <Image
                          src={photoUrl}
                          alt={getMediaAlt(photo, coach.name)}
                          fill
                          sizes="(max-width: 860px) 100vw, 33vw"
                          className="object-cover"
                        />
                      ) : (
                        <>
                          <BrandPattern variant="white" size={54} opacity={0.09} />
                          <ChessPiece
                            code={PROFILE_PIECES[i % PROFILE_PIECES.length]}
                            className="relative w-24 drop-shadow-[0_8px_14px_rgba(0,0,0,.4)]"
                          />
                          <span className="absolute bottom-2.5 right-3 text-[11px] text-white/55">
                            {tCommon('coachImagePlaceholder')}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-[20px] font-black text-ink">{coach.name}</h3>
                      <span className="mt-0.5 font-cond text-[13px] font-bold uppercase tracking-[0.08em] text-teal-deep">
                        {coach.role || t('roleFallback')}
                      </span>
                      {coach.titles && coach.titles.length > 0 && (
                        <ul className="mt-3 flex flex-wrap gap-1.5">
                          {coach.titles.map((item) => (
                            <li
                              key={item.id ?? item.title}
                              className="rounded-pill bg-navy-soft px-2.5 py-0.5 text-xs font-medium text-navy"
                            >
                              {item.title}
                            </li>
                          ))}
                        </ul>
                      )}
                      {coach.bio && (
                        <div className="mt-3 text-sm leading-relaxed text-[#4a4f63]">
                          <RichTextContent data={coach.bio} />
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </Reveal>
          )}
        </div>
      </section>
    </>
  )
}
