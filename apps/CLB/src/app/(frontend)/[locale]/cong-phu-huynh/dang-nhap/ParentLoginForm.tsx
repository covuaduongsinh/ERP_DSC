'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { sendOtp, verifyOtp } from '@/app/actions/parentAuth'
import { isValidVietnamesePhone } from '@/lib/phone'

type Step = 'phone' | 'otp'

const inputClass =
  'w-full rounded-md border border-primary/20 bg-[var(--ds-bg)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary'

export function ParentLoginForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Chỉ dùng trong dev mode để hiển thị OTP ngay trên màn hình
  const [devCode, setDevCode] = useState<string | undefined>(undefined)

  async function handleSendOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!isValidVietnamesePhone(phone)) {
      setError('Số điện thoại không hợp lệ.')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('phone', phone)
    const res = await sendOtp(fd)
    setSubmitting(false)
    if (res.success) {
      setDevCode(res.devCode)
      setStep('otp')
    } else {
      setError(res.message)
    }
  }

  async function handleVerifyOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(code)) {
      setError('Mã OTP phải gồm 6 chữ số.')
      return
    }
    setSubmitting(true)
    const fd = new FormData()
    fd.append('phone', phone)
    fd.append('code', code)
    const res = await verifyOtp(fd)
    setSubmitting(false)
    if (res.success) {
      router.push('/cong-phu-huynh')
      router.refresh()
    } else {
      setError(res.message)
    }
  }

  return (
    <div className="rounded-lg bg-[var(--ds-white)] p-6 shadow-sm">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-primary/40 bg-[var(--ds-bg)] px-3 py-2 text-sm text-primary"
        >
          {error}
        </div>
      )}

      {step === 'phone' ? (
        <form onSubmit={handleSendOtp} noValidate>
          <label htmlFor="phone" className="mb-1 block text-sm font-medium">
            Số điện thoại
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="VD: 0987654321"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="ds-btn mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang gửi…' : 'Gửi mã OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerifyOtp} noValidate>
          <p className="mb-3 text-sm text-[var(--ds-text-muted)]">
            Mã đã gửi tới <strong>{phone}</strong>. Mã có hiệu lực 5 phút.
          </p>
          {devCode && (
            <div className="mb-3 rounded-md border border-dashed border-primary/40 bg-[var(--ds-bg)] px-3 py-2 text-xs">
              <span className="font-semibold">[DEV]</span> OTP:{' '}
              <code className="font-mono">{devCode}</code>
            </div>
          )}
          <label htmlFor="code" className="mb-1 block text-sm font-medium">
            Mã OTP (6 chữ số)
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${inputClass} text-center tracking-[0.4em] font-mono text-lg`}
            required
          />
          <button
            type="submit"
            disabled={submitting}
            className="ds-btn mt-4 w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang xác thực…' : 'Đăng nhập'}
          </button>
          <button
            type="button"
            className="mt-3 w-full text-sm text-[var(--ds-text-muted)] underline-offset-2 hover:underline"
            onClick={() => {
              setStep('phone')
              setCode('')
              setDevCode(undefined)
              setError('')
            }}
          >
            Đổi số điện thoại khác
          </button>
        </form>
      )}
    </div>
  )
}
