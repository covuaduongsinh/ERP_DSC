'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useCallback, useId, useState } from 'react';
import { submitConsultation } from '@/app/actions/submitConsultation';
import { buttonClass } from '@/components/ui/Button';
import { Overline } from '@/components/ui/Overline';
import { fbTrack } from '@/lib/analytics/fb';
import { trackEvent } from '@/lib/analytics/ga';
import { isValidVietnamesePhone } from '@/lib/phone';
import type { ConsultationFormData, ConsultationLocationOption } from './types';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
type FieldErrors = Partial<Record<'fullName' | 'phone', string>>;

type ConsultationFormClientProps = {
  locations: ConsultationLocationOption[];
  formId?: string;
  /** Hiện ô Ghi chú (textarea) — bật ở trang Liên hệ */
  showNote?: boolean;
};

const labelClass = 'mb-[7px] block text-[13.5px] font-semibold text-[#3a3f52]';
const fieldBase =
  'w-full rounded-md border-[1.5px] bg-white px-3.5 py-3 text-[15px] text-ink outline-none transition-[border-color,box-shadow]';
const fieldValid =
  'border-line focus:border-navy focus:shadow-[0_0_0_3px_rgba(43,57,144,.14)]';
const fieldInvalid =
  'border-[#cf3b32] shadow-[0_0_0_3px_rgba(207,59,50,.13)] focus:border-[#cf3b32]';

function fieldClass(invalid?: boolean): string {
  return `${fieldBase} ${invalid ? fieldInvalid : fieldValid}`;
}

function validate(
  data: ConsultationFormData,
  tErrors: (key: string) => string,
): FieldErrors {
  const errors: FieldErrors = {};
  const name = data.fullName.trim();
  if (!name) errors.fullName = tErrors('fullNameRequired');
  else if (name.length < 2) errors.fullName = tErrors('fullNameMin');

  if (!data.phone.trim()) errors.phone = tErrors('phoneRequired');
  else if (!isValidVietnamesePhone(data.phone))
    errors.phone = tErrors('phoneInvalid');

  return errors;
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export function ConsultationFormClient({
  locations,
  formId = 'tu-van',
  showNote = false,
}: ConsultationFormClientProps) {
  const t = useTranslations('form');
  const reactId = useId();
  const id = formId || `tu-van-${reactId}`;

  const [status, setStatus] = useState<FormStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverErrorMessage, setServerErrorMessage] = useState('');
  const [submitted, setSubmitted] = useState<{ name: string; phone: string }>({
    name: '',
    phone: '',
  });

  const resetForNewSubmit = useCallback(() => {
    setStatus('idle');
    setFieldErrors({});
    setServerErrorMessage('');
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    const form = event.currentTarget;
    const formData = new FormData(form);

    const data: ConsultationFormData = {
      fullName: String(formData.get('fullName') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      childAge: String(formData.get('childAge') ?? '').trim() || undefined,
      interestedLocation:
        String(formData.get('interestedLocation') ?? '').trim() || undefined,
      note: String(formData.get('note') ?? '').trim() || undefined,
    };

    const errors = validate(data, (key) => t(`errors.${key}`));
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStatus('idle');
      return;
    }

    setFieldErrors({});
    setServerErrorMessage('');
    setStatus('submitting');

    try {
      const result = await submitConsultation(formData);
      if (result.success) {
        fbTrack('Lead');
        trackEvent('generate_lead');
        setSubmitted({ name: data.fullName.trim(), phone: data.phone.trim() });
        setStatus('success');
        form.reset();
      } else {
        setServerErrorMessage(result.message);
        setStatus('error');
      }
    } catch {
      setServerErrorMessage(t('errorMessage'));
      setStatus('error');
    }
  };

  return (
    <div className="grid overflow-hidden rounded-ds-2xl border border-line bg-white shadow-ds-lg min-[860px]:grid-cols-2">
      {/* Panel trái — navy */}
      <div className="relative overflow-hidden bg-navy px-9 py-12 text-white sm:px-11">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[.07]"
          style={{
            backgroundImage: 'url(/brand/pattern-tile-white.svg)',
            backgroundSize: '54px',
          }}
        />
        <Overline tone="light" className="relative">
          {t('cardOverline')}
        </Overline>
        <h2 className="relative mt-3 text-[30px] font-black leading-[1.15]">
          {t('cardTitle')}
        </h2>
        <p className="relative mb-7 mt-3.5 text-[15.5px] leading-relaxed text-white/[.82]">
          {t('cardDesc')}
        </p>
        {[t('perk1'), t('perk2'), t('perk3')].map((perk) => (
          <div key={perk} className="relative mb-3.5 flex items-center gap-3 text-[15px]">
            <span className="w-5 shrink-0 text-teal">
              <CheckIcon />
            </span>
            {perk}
          </div>
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/symbol-white.svg"
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-8 -right-8 w-[170px] opacity-[.13]"
        />
      </div>

      {/* Panel phải — form / success */}
      <div className="p-9 sm:p-10">
        {status === 'success' ? (
          <div className="py-9 text-center" role="status" aria-live="polite">
            <div className="mx-auto mb-[18px] flex h-[76px] w-[76px] items-center justify-center rounded-full bg-teal-soft text-teal-deep">
              <span className="w-[38px]">
                <CheckIcon />
              </span>
            </div>
            <h3 className="mb-2.5 text-[23px] font-black text-ink">
              {t('successTitle')}
            </h3>
            <p className="mx-auto mb-6 max-w-[340px] text-[15px] leading-relaxed text-muted">
              {submitted.name
                ? t('successEchoMessage', {
                    name: submitted.name,
                    phone: submitted.phone,
                  })
                : t('successMessage')}
            </p>
            <button
              type="button"
              className={buttonClass('ghost', 'md')}
              onClick={resetForNewSubmit}
            >
              {t('submitAgain')}
            </button>
          </div>
        ) : (
          <form id={id} noValidate onSubmit={handleSubmit}>
            {/* Honeypot — bot điền; người dùng không thấy */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '-9999px',
                width: 0,
                height: 0,
                overflow: 'hidden',
              }}
            >
              <label htmlFor={`${id}-website`}>Website</label>
              <input
                id={`${id}-website`}
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {status === 'error' && (
              <div
                className="mb-4 rounded-md border border-[#cf3b32]/40 bg-[#fdeceb] px-4 py-3 text-sm"
                role="alert"
                aria-live="assertive"
              >
                <p className="font-semibold text-[#cf3b32]">{t('errorTitle')}</p>
                <p className="mt-1 text-muted">
                  {serverErrorMessage || t('errorMessage')}
                </p>
              </div>
            )}

            <div className="mb-4">
              <label htmlFor={`${id}-fullName`} className={labelClass}>
                {t('fullName')} <span className="text-navy">*</span>
              </label>
              <input
                id={`${id}-fullName`}
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder={t('fullNamePlaceholder')}
                aria-invalid={fieldErrors.fullName ? true : undefined}
                aria-describedby={
                  fieldErrors.fullName ? `${id}-fullName-error` : undefined
                }
                className={fieldClass(Boolean(fieldErrors.fullName))}
              />
              {fieldErrors.fullName && (
                <p
                  id={`${id}-fullName-error`}
                  className="mt-1.5 text-[12.5px] text-[#cf3b32]"
                  role="alert"
                >
                  {fieldErrors.fullName}
                </p>
              )}
            </div>

            <div className="mb-4 grid gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor={`${id}-phone`} className={labelClass}>
                  {t('phone')} <span className="text-navy">*</span>
                </label>
                <input
                  id={`${id}-phone`}
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t('phonePlaceholder')}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  aria-describedby={
                    fieldErrors.phone ? `${id}-phone-error` : undefined
                  }
                  className={fieldClass(Boolean(fieldErrors.phone))}
                />
                {fieldErrors.phone && (
                  <p
                    id={`${id}-phone-error`}
                    className="mt-1.5 text-[12.5px] text-[#cf3b32]"
                    role="alert"
                  >
                    {fieldErrors.phone}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={`${id}-childAge`} className={labelClass}>
                  {t('childAge')}
                </label>
                <input
                  id={`${id}-childAge`}
                  name="childAge"
                  type="text"
                  placeholder={t('childAgePlaceholder')}
                  className={fieldClass()}
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor={`${id}-location`} className={labelClass}>
                {t('location')}
              </label>
              <select
                id={`${id}-location`}
                name="interestedLocation"
                className={fieldClass()}
                defaultValue=""
              >
                <option value="">{t('locationPlaceholder')}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {showNote && (
              <div className="mb-4">
                <label htmlFor={`${id}-note`} className={labelClass}>
                  {t('note')}
                </label>
                <textarea
                  id={`${id}-note`}
                  name="note"
                  rows={3}
                  placeholder={t('notePlaceholder')}
                  className={`${fieldClass()} min-h-24 resize-y`}
                />
              </div>
            )}

            <button
              type="submit"
              className={`mt-1.5 w-full ${buttonClass('primary', 'md')}`}
              disabled={status === 'submitting'}
              aria-busy={status === 'submitting'}
            >
              {status === 'submitting' ? t('submitting') : t('submit')}
            </button>
            <p className="mt-3.5 text-center text-xs text-muted">
              {t('privacyHint')}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
