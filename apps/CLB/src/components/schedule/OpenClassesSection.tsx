import { getTranslations } from 'next-intl/server'
import { TrialRequestForm } from '@/components/forms/TrialRequestForm'
import { buttonClass } from '@/components/ui/Button'
import { ClockIcon, PinIcon } from '@/components/ui/icons'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Link } from '@/i18n/navigation'
import { getAgeGroupLabel, getLevelLabel } from '@/lib/labels'
import { DAY_LABEL } from '@/lib/operations/schedule'
import { getOpenClasses, groupOpenClassesByTrack, type OpenClassCard } from '@/lib/open-classes'
import { routes } from '@/lib/routes'

type OpenClassesSectionProps = {
  /** home: teaser (giới hạn ~2 lớp/tuyến + link "Xem tất cả"); page: đầy đủ + form học thử inline. */
  variant?: 'home' | 'page'
}

/** Số lớp tối đa mỗi tuyến ở teaser trang chủ (hiện đủ 3 tuyến, vẫn gọn). */
const HOME_PER_TRACK = 2

/** Danh sách lịch (ngày + giờ) của một lớp — hoặc thông báo "đang cập nhật". */
function ScheduleLines({ card, pendingLabel }: { card: OpenClassCard; pendingLabel: string }) {
  if (card.schedule.length === 0) {
    return <span className="text-muted">{pendingLabel}</span>
  }
  return (
    <ul className="flex flex-col gap-0.5">
      {card.schedule.map((slot, i) => (
        <li key={`${slot.thu}-${slot.gioBatDau}-${i}`}>
          <span className="font-semibold text-ink">{DAY_LABEL[slot.thu]}</span> {slot.gioBatDau}–
          {slot.gioKetThuc}
        </li>
      ))}
    </ul>
  )
}

/**
 * Thẻ một lớp đang mở. CHỈ hiển thị: tên lớp, nhóm tuổi, cơ sở, lịch — và (tuỳ chọn)
 * badge cấp độ. KHÔNG hiển thị giáo viên/phòng/sĩ số (rule bảo mật — đã lọc ở DTO).
 */
function OpenClassCardView({
  card,
  pendingLabel,
  showLevel,
  showTrial,
}: {
  card: OpenClassCard
  pendingLabel: string
  showLevel: boolean
  showTrial: boolean
}) {
  return (
    <article className="flex flex-col rounded-ds-xl border border-line bg-white p-6 transition-shadow duration-200 hover:shadow-ds-md">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[18px] font-black leading-snug text-ink">{card.title}</h3>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {(card.ageGroup ?? []).map((ag) => (
            <span
              key={ag}
              className="rounded-pill bg-teal-soft px-2.5 py-0.5 text-xs font-bold text-teal-deep"
            >
              {getAgeGroupLabel(ag)}
            </span>
          ))}
        </div>
      </div>

      {showLevel && (card.level?.length ?? 0) > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(card.level ?? []).map((lv) => (
            <span
              key={lv}
              className="w-fit rounded-pill bg-navy-soft px-2.5 py-0.5 text-xs font-bold text-navy"
            >
              {getLevelLabel(lv)}
            </span>
          ))}
        </div>
      )}

      {card.locationName && (
        <p className="mt-3 flex items-center gap-2 text-sm text-[#4a4f63]">
          <PinIcon className="w-[18px] shrink-0 text-teal-deep" />
          {card.locationName}
        </p>
      )}

      <div className="mt-2 flex items-start gap-2 text-sm text-[#4a4f63]">
        <ClockIcon className="mt-0.5 w-[18px] shrink-0 text-teal-deep" />
        <ScheduleLines card={card} pendingLabel={pendingLabel} />
      </div>

      {showTrial && (
        <div className="mt-auto pt-5">
          <TrialRequestForm classId={card.id} classTitle={card.title} />
        </div>
      )}
    </article>
  )
}

/**
 * Duyệt lớp học VẬN HÀNH đang mở (nguồn: collection `classes`, `trangThai=dang_mo`),
 * GOM theo 3 TUYẾN (Nhập môn / Cơ bản / Nâng cao) — mỗi thẻ gắn badge cấp. Trang đầy
 * đủ kèm form "Đăng ký học thử" inline mỗi thẻ; teaser trang chủ hiện ~2 lớp/tuyến +
 * link sang trang Lịch khai giảng. Ẩn field vận hành nội bộ (GV/phòng/sĩ số).
 */
export async function OpenClassesSection({ variant = 'page' }: OpenClassesSectionProps) {
  const t = await getTranslations('schedule')
  const tTrack = await getTranslations('training')
  const cards = await getOpenClasses()

  // Teaser trang chủ: ẩn hẳn nếu chưa có lớp. Trang đầy đủ: hiện thông báo rỗng.
  if (cards.length === 0) {
    if (variant === 'home') return null
    return (
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-container px-[18px] sm:px-7">
          <SectionHeading title={t('classesTitle')} subtitle={t('classesSubtitle')} />
          <p className="text-center text-muted">{t('classesEmpty')}</p>
        </div>
      </section>
    )
  }

  const isHome = variant === 'home'
  // Gom theo tuyến; teaser thì giới hạn số lớp mỗi tuyến (vẫn hiện đủ 3 tuyến).
  const groups = groupOpenClassesByTrack(cards).map((group) =>
    isHome ? { ...group, classes: group.classes.slice(0, HOME_PER_TRACK) } : group,
  )
  const cardGrid = isHome
    ? 'grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3'
    : 'grid gap-6 sm:grid-cols-2'

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading title={t('classesTitle')} subtitle={t('classesSubtitle')} />
        <div className="flex flex-col gap-12">
          {groups.map((group) => (
            <div key={group.track}>
              <div className="mb-5 flex items-baseline gap-3">
                <h3 className="font-cond text-[24px] font-black text-navy">
                  {tTrack(`tracks.${group.track}`)}
                </h3>
                {!isHome && (
                  <span className="text-sm text-muted">
                    {t('classCount', { count: group.classes.length })}
                  </span>
                )}
              </div>
              <Reveal className={cardGrid}>
                {group.classes.map((card) => (
                  <OpenClassCardView
                    key={card.id}
                    card={card}
                    pendingLabel={t('schedulePending')}
                    showLevel
                    showTrial={!isHome}
                  />
                ))}
              </Reveal>
            </div>
          ))}
        </div>
        {isHome && (
          <div className="mt-10 text-center">
            <Link href={routes.openingSchedule} className={buttonClass('ghost', 'md')}>
              {t('viewAllClasses')} →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
