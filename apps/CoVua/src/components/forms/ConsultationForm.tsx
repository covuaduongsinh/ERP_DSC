import dynamic from 'next/dynamic';
import type { Location } from '@/payload-types';
import type { ConsultationLocationOption } from './types';

const ConsultationFormClient = dynamic(
  () =>
    import('./ConsultationFormClient').then((mod) => mod.ConsultationFormClient),
  {
    loading: () => (
      <div
        className="grid overflow-hidden rounded-ds-2xl border border-line bg-white shadow-ds-lg min-[860px]:grid-cols-2"
        aria-hidden
      >
        <div className="bg-navy px-9 py-12 sm:px-11">
          <div className="h-4 w-32 animate-pulse rounded bg-white/20" />
          <div className="mt-4 h-7 w-3/4 animate-pulse rounded bg-white/20" />
        </div>
        <div className="space-y-4 p-9 sm:p-10">
          <div className="h-11 animate-pulse rounded-md bg-bg" />
          <div className="h-11 animate-pulse rounded-md bg-bg" />
          <div className="h-11 animate-pulse rounded-md bg-bg" />
        </div>
      </div>
    ),
  },
);

type ConsultationFormProps = {
  locations: Location[];
  id?: string;
  /** Hiện ô Ghi chú (textarea) — bật ở trang Liên hệ */
  showNote?: boolean;
};

export function ConsultationForm({ locations, id, showNote }: ConsultationFormProps) {
  const options: ConsultationLocationOption[] = locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
  }));

  return (
    <ConsultationFormClient locations={options} formId={id} showNote={showNote} />
  );
}
