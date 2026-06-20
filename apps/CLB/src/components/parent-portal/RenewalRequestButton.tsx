'use client'

import { useState, useTransition } from 'react'
import {
  submitRenewalRequest,
  type SubmitRenewalRequestResult,
} from '@/app/actions/submitRenewalRequest'

type RenewalRequestButtonProps = {
  studentId: number
  tuitionCycleId?: number | null
  hasPendingRequest?: boolean
  className?: string
}

export function RenewalRequestButton({
  studentId,
  tuitionCycleId,
  hasPendingRequest = false,
  className = '',
}: RenewalRequestButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<SubmitRenewalRequestResult | null>(null)

  if (hasPendingRequest) {
    return (
      <p className="mt-3 rounded-lg bg-[var(--ds-teal)]/10 px-3 py-2 text-xs font-medium text-primary">
        Yêu cầu gia hạn đang chờ nhân viên xử lý.
      </p>
    )
  }

  if (result?.success) {
    return (
      <p className="mt-3 rounded-lg bg-[var(--ds-teal)]/10 px-3 py-2 text-xs font-medium text-primary">
        {result.message}
      </p>
    )
  }

  function handleSubmit() {
    setResult(null)
    const formData = new FormData()
    formData.set('studentId', String(studentId))
    if (tuitionCycleId) {
      formData.set('tuitionCycleId', String(tuitionCycleId))
    }

    startTransition(async () => {
      const response = await submitRenewalRequest(formData)
      setResult(response)
    })
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="ds-btn inline-flex w-full justify-center text-sm disabled:opacity-60"
      >
        {isPending ? 'Đang gửi…' : 'Đăng ký gia hạn'}
      </button>
      {result && !result.success ? (
        <p className="mt-2 text-xs text-primary" role="alert">
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
