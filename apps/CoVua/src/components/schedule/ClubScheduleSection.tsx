import { getTranslations } from 'next-intl/server';
import { buttonClass } from '@/components/ui/Button';
import { BuildingIcon, ClockIcon, PinIcon } from '@/components/ui/icons';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { Link } from '@/i18n/navigation';
import { getPayloadClient } from '@/lib/payload';
import { routes } from '@/lib/routes';

type ClubScheduleSectionProps = {
  /** home: thêm link "Xem tất cả" → trang Lịch khai giảng */
  variant?: 'home' | 'page';
};

/**
 * Lịch học theo cơ sở — đọc từ collection curated `web-locations` (NỘI DUNG WEBSITE):
 * địa chỉ + khung giờ chung từng cơ sở + bản đồ. Danh sách lớp THẬT (theo cấp, có
 * học thử) nằm ở `OpenClassesSection` (nguồn `classes` vận hành). Ẩn nếu chưa có dữ liệu.
 */
export async function ClubScheduleSection({
  variant = 'page',
}: ClubScheduleSectionProps) {
  const t = await getTranslations('schedule');
  const tCommon = await getTranslations('common');
  const payload = await getPayloadClient();

  const { docs: locations } = await payload.find({
    collection: 'web-locations',
    limit: 20,
    sort: 'order',
  });

  if (locations.length === 0) return null;

  return (
    <section className="bg-bg py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading
          title={t('locationsTitle')}
          subtitle={t('locationsSubtitle')}
        />

        <Reveal className="grid gap-6 sm:grid-cols-2">
          {locations.map((loc) => {
            const times = (loc.lichHocGio ?? [])
              .map((slot) => slot.gio)
              .filter(Boolean);
            return (
              <article
                key={loc.id}
                className="flex flex-col rounded-ds-xl border border-line bg-white p-6 transition-shadow duration-200 hover:shadow-ds-md sm:p-7"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-ds-md bg-navy-soft text-navy">
                    <BuildingIcon className="w-[22px]" />
                  </span>
                  <h3 className="text-[19px] font-black text-ink">{loc.name}</h3>
                </div>

                <p className="mt-4 flex items-start gap-2.5 text-sm leading-relaxed text-[#4a4f63]">
                  <PinIcon className="mt-0.5 w-[18px] shrink-0 text-teal-deep" />
                  <span className="whitespace-pre-line">{loc.address}</span>
                </p>

                {(loc.lichHocNgay || times.length > 0) && (
                  <div className="mt-3 flex items-start gap-2.5 text-sm text-[#4a4f63]">
                    <ClockIcon className="mt-0.5 w-[18px] shrink-0 text-teal-deep" />
                    <div>
                      {loc.lichHocNgay && (
                        <span className="font-semibold text-ink">
                          {loc.lichHocNgay}
                        </span>
                      )}
                      {times.length > 0 && (
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {times.map((time) => (
                            <li key={time}>{time}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-6 flex flex-wrap gap-3">
                  {loc.mapUrl && (
                    <a
                      href={loc.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass('ghost', 'sm')}
                    >
                      {t('viewMap')}
                    </a>
                  )}
                  <Link
                    href={{ pathname: routes.home, hash: 'tu-van' }}
                    className={buttonClass('primary', 'sm')}
                  >
                    {tCommon('register')}
                  </Link>
                </div>
              </article>
            );
          })}
        </Reveal>

        {variant === 'home' && (
          <div className="mt-10 text-center">
            <Link
              href={routes.openingSchedule}
              className={buttonClass('ghost', 'md')}
            >
              {tCommon('viewAll')} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
