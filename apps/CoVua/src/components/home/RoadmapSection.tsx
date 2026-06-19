import { brand } from '@ds/brand';
import { getTranslations } from 'next-intl/server';
import { ChessPiece } from '@/components/brand/ChessPiece';
import { buttonClass } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from '@/i18n/navigation';
import { pieceForLevel } from '@/lib/chess';
import { routes } from '@/lib/routes';

export async function RoadmapSection() {
  const t = await getTranslations('home');
  const tTrack = await getTranslations('training');

  return (
    <section className="bg-white py-16 sm:py-20 min-[860px]:py-[84px]">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading
          overline={t('roadmapTitle')}
          overlineTone="teal"
          title={t('roadmapSubtitle')}
          subtitle={t('roadmapLead')}
        />

        <Reveal className="relative mx-auto max-w-[920px]">
          <div
            aria-hidden
            className="absolute inset-x-[7%] top-[38px] hidden h-[3px] rounded bg-[linear-gradient(90deg,var(--ds-primary),var(--ds-teal))] opacity-25 min-[860px]:block"
          />
          <ol className="flex flex-wrap items-start justify-center gap-x-3 gap-y-7 min-[860px]:flex-nowrap min-[860px]:justify-between">
            {brand.roadmap.map((step, i) => (
              <li
                key={step.piece}
                className="group relative z-[1] flex basis-[40%] flex-col items-center gap-3 min-[520px]:basis-[26%] min-[860px]:flex-1"
              >
                <div className="relative">
                  <span className="absolute -top-1.5 right-3 z-[1] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-teal font-cond text-[11px] font-black text-[#063]">
                    {i + 1}
                  </span>
                  <div
                    className={`flex h-[76px] w-[76px] items-center justify-center rounded-full border-2 transition-[transform,border-color,box-shadow] duration-200 ease-ds group-hover:-translate-y-[5px] group-hover:border-navy group-hover:shadow-ds-md ${
                      i === 0 ? 'border-navy bg-navy' : 'border-line bg-white'
                    }`}
                  >
                    <ChessPiece
                      code={pieceForLevel(step.piece)}
                      className="h-[46px] w-[46px]"
                    />
                  </div>
                </div>
                <span className="font-cond text-[20px] font-black text-navy">
                  {step.piece}
                </span>
                {/* Nhãn tuyến ở quân ĐẦU mỗi tuyến (Tốt/Mã/Hậu) — gom 6 cấp thành 3 tuyến. */}
                {(i === 0 || brand.roadmap[i - 1].track !== step.track) && (
                  <span className="-mt-1.5 rounded-pill bg-teal-soft px-2.5 py-0.5 text-[11.5px] font-bold uppercase tracking-[0.08em] text-teal-deep">
                    {tTrack(`tracks.${step.track}`)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Reveal>

        <div className="mt-10 text-center">
          <Link href={routes.training} className={buttonClass('ghost', 'md')}>
            {t('roadmapCta')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
