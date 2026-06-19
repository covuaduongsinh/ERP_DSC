import { getTranslations } from 'next-intl/server';
import { ClockIcon } from '@/components/ui/icons';
import { Reveal } from '@/components/ui/Reveal';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { formatDateTime, getEventTypeLabel } from '@/lib/labels';
import type { Event } from '@/payload-types';

type UpcomingEventsSectionProps = {
  events: Event[];
  locale: string;
};

function dateParts(date: string, locale: string) {
  const d = new Date(date);
  const fmt = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', options).format(d);
  return { day: fmt({ day: 'numeric' }), month: fmt({ month: 'short' }) };
}

export async function UpcomingEventsSection({
  events,
  locale,
}: UpcomingEventsSectionProps) {
  const t = await getTranslations('schedule');

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading
          overline={t('title')}
          title={t('eventsTitle')}
          subtitle={t('eventsSubtitle')}
        />
        {events.length > 0 ? (
          <Reveal className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
            {events.map((event) => {
              const { day, month } = dateParts(event.date, locale);
              return (
                <article
                  key={event.id}
                  className="flex flex-col overflow-hidden rounded-ds-xl border border-line bg-white transition-shadow duration-200 hover:shadow-ds-md"
                >
                  <div className="flex items-center gap-4 bg-[linear-gradient(150deg,var(--ds-primary),var(--ds-navy-deep))] p-5 text-white">
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-ds-md bg-white text-navy">
                      <span className="font-cond text-[22px] font-black leading-none">
                        {day}
                      </span>
                      <span className="font-cond text-[11px] font-bold uppercase">
                        {month}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <span className="font-cond text-[11.5px] font-bold uppercase tracking-[0.08em] text-teal">
                        {getEventTypeLabel(event.type)}
                      </span>
                      <h3 className="text-[17px] font-bold leading-snug">
                        {event.title}
                      </h3>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    {event.summary && (
                      <p className="text-sm leading-relaxed text-[#4a4f63]">
                        {event.summary}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-sm text-muted">
                      <ClockIcon className="w-4 shrink-0 text-teal-deep" />
                      <time dateTime={event.date}>
                        {formatDateTime(event.date, locale)}
                      </time>
                    </div>
                  </div>
                </article>
              );
            })}
          </Reveal>
        ) : (
          <p className="text-center text-muted">{t('eventsEmpty')}</p>
        )}
      </div>
    </section>
  );
}
