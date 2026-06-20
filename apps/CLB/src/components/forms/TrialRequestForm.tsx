'use client'

import { useTranslations } from 'next-intl'
import { type FormEvent, useId, useState } from 'react'
import { submitTrialRequest } from '@/app/actions/submitTrialRequest'
import { buttonClass } from '@/components/ui/Button'
import { fbTrack } from '@/lib/analytics/fb'
import { trackEvent } from '@/lib/analytics/ga'
import { isValidVietnamesePhone } from '@/lib/phone'

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'
type FieldErrors = Partial<Record<'fullName' | 'phone', string>>

type TrialRequestFormProps = {
  /** Lớp đang mở phụ huynh muốn học thử (gửi kèm lead). */
  classId: number
  /** Tên lớp — hiển thị trên form, KHÔNG dùng để định danh phía server. */
  classTitle: string
}

const labelClass = 'mb-1.5 block text-[13px] font-semibold text-[#3a3f52]'
const fieldClass =
  'w-full rounded-md border-[1.5px] border-line bg-white px-3 py-2.5 text-[14.5px] text-ink outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_rgba(43,57,144,.14)]'

/**
 * Nút "Đăng ký học thử" + form inline (disclosure) ngay dưới thẻ lớp. Gửi tới
 * Server Action submitTrialRequest → tạo Lead status=dang_ky_hoc_thu gắn lớp.
 */
export function TrialRequestForm({ classId, classTitle }: TrialRequestFormProps) {
  const t = useTranslations('form')
  const tSchedule = useTranslations('schedule')
  const reactId = useId()
  const panelId = `trial-${classId}-${reactId}`

  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverErrorMessage, setServerErrorMessage] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (status === 'submitting') return

    const form = event.currentTarget
    const formData = new FormData(form)
    const fullName = String(formData.get('fullName') ?? '').trim()
    const phone = String(formData.get('phone') ?? '').trim()

    const errors: FieldErrors = {}
    if (!fullName) errors.fullName = t('errors.fullNameRequired')
    else if (fullName.length < 2) errors.fullName = t('errors.fullNameMin')
    if (!phone) errors.phone = t('errors.phoneRequired')
    else if (!isValidVietnamesePhone(phone)) errors.phone = t('errors.phoneInvalid')

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setServerErrorMessage('')
    setStatus('submitting')

    try {
      const result = await submitTrialRequest(formData)
      if (result.success) {
        fbTrack('Lead')
        trackEvent('generate_lead', { content_name: classTitle })
        setStatus('success')
        form.reset()
      } else {
        setServerErrorMessage(result.message)
        setStatus('error')
      }
    } catch {
      setServerErrorMessage(t('errorMessage'))
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        className="rounded-ds-md bg-teal-soft px-4 py-3 text-sm font-semibold text-teal-deep"
        role="status"
        aria-live="polite"
      >
        {t('trialSuccessMessage')}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        className={`w-full ${buttonClass('primary', 'sm')}`}
        onClick={() => setOpen(true)}
        aria-expanded={false}
        aria-controls={panelId}
      >
        {tSchedule('trialCta')}
      </button>
    )
  }

  return (
    <form
      id={panelId}
      noValidate
      onSubmit={handleSubmit}
      className="rounded-ds-md border border-line bg-bg p-4"
    >
      <p className="mb-3 text-[13.5px] font-bold text-navy">
        {t('trialFor', { className: classTitle })}
      </p>

      {/* Honeypot — bot điền; người dùng không thấy */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: 0, height: 0, overflow: 'hidden' }}
      >
        <label htmlFor={`${panelId}-website`}>Website</label>
        <input
          id={`${panelId}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <input type="hidden" name="interestedClass" value={classId} />

      {status === 'error' && (
        <p
          className="mb-3 rounded-md border border-[#cf3b32]/40 bg-[#fdeceb] px-3 py-2 text-[13px] text-[#cf3b32]"
          role="alert"
          aria-live="assertive"
        >
          {serverErrorMessage || t('errorMessage')}
        </p>
      )}

      <div className="mb-3">
        <label htmlFor={`${panelId}-fullName`} className={labelClass}>
          {t('fullName')} <span className="text-navy">*</span>
        </label>
        <input
          id={`${panelId}-fullName`}
          name="fullName"
          type="text"
          autoComplete="name"
          placeholder={t('fullNamePlaceholder')}
          aria-invalid={fieldErrors.fullName ? true : undefined}
          className={fieldClass}
        />
        {fieldErrors.fullName && (
          <p className="mt-1 text-[12px] text-[#cf3b32]" role="alert">
            {fieldErrors.fullName}
          </p>
        )}
      </div>

      <div className="mb-3.5 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${panelId}-phone`} className={labelClass}>
            {t('phone')} <span className="text-navy">*</span>
          </label>
          <input
            id={`${panelId}-phone`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t('phonePlaceholder')}
            aria-invalid={fieldErrors.phone ? true : undefined}
            className={fieldClass}
          />
          {fieldErrors.phone && (
            <p className="mt-1 text-[12px] text-[#cf3b32]" role="alert">
              {fieldErrors.phone}
            </p>
          )}
        </div>
        <div>
          <label htmlFor={`${panelId}-childAge`} className={labelClass}>
            {t('childAge')}
          </label>
          <input
            id={`${panelId}-childAge`}
            name="childAge"
            type="text"
            placeholder={t('childAgePlaceholder')}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex gap-2.5">
        <button
          type="submit"
          className={`flex-1 ${buttonClass('primary', 'sm')}`}
          disabled={status === 'submitting'}
          aria-busy={status === 'submitting'}
        >
          {status === 'submitting' ? t('submitting') : t('submit')}
        </button>
        <button type="button" className={buttonClass('ghost', 'sm')} onClick={() => setOpen(false)}>
          {tSchedule('trialClose')}
        </button>
      </div>
    </form>
  )
}
