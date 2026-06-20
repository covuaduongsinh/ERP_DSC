'use client'

import { Button } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { Fragment, useCallback, useMemo, useState, useTransition } from 'react'
import type { RenewalRequest, TuitionCycle } from '@/payload-types'
import { approveRenewal, rejectRenewal } from '@/app/actions/processRenewal'
import { suggestExpectedEndDate } from '@/lib/tuition'

/** Một dòng yêu cầu để hiển thị — đã rút gọn từ RenewalRequest ở phía server. */
export interface RenewalRow {
  id: number
  studentName: string
  parentName: string | null
  parentPhone: string | null
  currentPackage: TuitionCycle['package'] | null
  sessionsRemaining: number
  parentNote: string | null
  status: RenewalRequest['status']
  createdAt: string
}

export interface RenewalQueueClientProps {
  initialRequests: RenewalRow[]
  /** true nếu danh sách bị cắt bớt (còn yêu cầu ngoài trang này). */
  truncated: boolean
}

const PACKAGE_OPTIONS: TuitionCycle['package'][] = ['10', '20', '40']

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

/** Hôm nay dạng yyyy-mm-dd cho <input type="date">. */
function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

type Mode = 'approve' | 'reject'

export function RenewalQueueClient({ initialRequests, truncated }: RenewalQueueClientProps) {
  const router = useRouter()
  const [requests, setRequests] = useState<RenewalRow[]>(initialRequests)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state (chỉ dùng cho dòng đang mở).
  const [pkg, setPkg] = useState<TuitionCycle['package']>('20')
  const [startDate, setStartDate] = useState<string>(todayInputValue())
  const [expectedEndDate, setExpectedEndDate] = useState<string>('')
  const [staffNote, setStaffNote] = useState<string>('')
  const [reason, setReason] = useState<string>('')

  // Gợi ý ngày hết gói (mềm) — nhân viên bấm để điền, vẫn sửa lại được.
  const suggestedEndDate = useMemo(() => suggestExpectedEndDate(startDate, pkg), [startDate, pkg])

  const closePanel = useCallback(() => {
    setActiveId(null)
    setMode(null)
    setError(null)
  }, [])

  const openApprove = useCallback((row: RenewalRow) => {
    setActiveId(row.id)
    setMode('approve')
    setError(null)
    setSuccess(null)
    setPkg(row.currentPackage ?? '20')
    setStartDate(todayInputValue())
    setExpectedEndDate('')
    setStaffNote('')
  }, [])

  const openReject = useCallback((row: RenewalRow) => {
    setActiveId(row.id)
    setMode('reject')
    setError(null)
    setSuccess(null)
    setReason('')
  }, [])

  const removeRow = useCallback((id: number) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const handleApprove = useCallback(
    (id: number) => {
      setError(null)
      startTransition(async () => {
        const res = await approveRenewal({
          id,
          package: pkg,
          startDate,
          expectedEndDate: expectedEndDate || undefined,
          staffNote: staffNote || undefined,
          confirm: true,
        })
        if (!res.ok) {
          setError(res.message)
          return
        }
        removeRow(id)
        closePanel()
        setSuccess(`Đã duyệt: tạo chu kỳ ${res.sessionsTotal} buổi (mã #${res.tuitionCycleId}).`)
        router.refresh()
      })
    },
    [closePanel, expectedEndDate, pkg, removeRow, router, staffNote, startDate],
  )

  const handleReject = useCallback(
    (id: number) => {
      setError(null)
      startTransition(async () => {
        const res = await rejectRenewal({ id, reason, confirm: true })
        if (!res.ok) {
          setError(res.message)
          return
        }
        removeRow(id)
        closePanel()
        setSuccess('Đã từ chối yêu cầu và ghi lý do.')
        router.refresh()
      })
    },
    [closePanel, reason, removeRow, router],
  )

  if (requests.length === 0) {
    return (
      <div>
        {success ? (
          <p aria-live="polite" className="ds-success">
            {success}
          </p>
        ) : null}
        <p className="ds-muted">Không còn yêu cầu gia hạn nào đang chờ.</p>
      </div>
    )
  }

  return (
    <div>
      {success ? (
        <p aria-live="polite" className="ds-success">
          {success}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="ds-error">
          {error}
        </p>
      ) : null}

      <p className="ds-muted" style={{ marginBottom: 12 }}>
        {requests.length} yêu cầu đang chờ
        {truncated ? ' (hiển thị một phần — xử lý bớt rồi tải lại)' : ''}
      </p>

      <div className="ds-tbl-wrap">
        <table className="ds-tbl">
          <thead>
            <tr>
              <th scope="col">Học viên</th>
              <th scope="col">Phụ huynh</th>
              <th scope="col">Gói hiện tại</th>
              <th scope="col">Buổi còn</th>
              <th scope="col">Gửi lúc</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((row) => {
              const isActive = activeId === row.id
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td>{row.studentName}</td>
                    <td>
                      {row.parentName ?? '—'}
                      {row.parentPhone ? <div className="ds-cellsub">{row.parentPhone}</div> : null}
                    </td>
                    <td>{row.currentPackage ? `${row.currentPackage} buổi` : '—'}</td>
                    <td className="ds-tbl__num">{row.sessionsRemaining}</td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <div className="ds-btns">
                        <Button
                          buttonStyle="primary"
                          size="small"
                          type="button"
                          disabled={isPending}
                          onClick={() => openApprove(row)}
                        >
                          Duyệt
                        </Button>
                        <Button
                          buttonStyle="secondary"
                          size="small"
                          type="button"
                          disabled={isPending}
                          onClick={() => openReject(row)}
                        >
                          Từ chối
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {isActive && mode === 'approve' ? (
                    <tr key={`${row.id}-approve`}>
                      <td colSpan={6}>
                        <div className="ds-card">
                          <p className="ds-formtitle">
                            Duyệt gia hạn cho {row.studentName} — chốt gói mới
                          </p>
                          {row.parentNote ? (
                            <p className="ds-muted" style={{ margin: '0 0 10px' }}>
                              Ghi chú phụ huynh: {row.parentNote}
                            </p>
                          ) : null}
                          <div className="ds-formrow">
                            <label className="ds-field">
                              Gói buổi
                              <select
                                className="ds-select"
                                value={pkg}
                                onChange={(e) => setPkg(e.target.value as TuitionCycle['package'])}
                                disabled={isPending}
                              >
                                {PACKAGE_OPTIONS.map((p) => (
                                  <option key={p} value={p}>
                                    {p} buổi
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="ds-field">
                              Ngày bắt đầu
                              <input
                                className="ds-input"
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                disabled={isPending}
                              />
                            </label>
                            <label className="ds-field">
                              Ngày dự kiến hết (tùy chọn)
                              <input
                                className="ds-input"
                                type="date"
                                value={expectedEndDate}
                                onChange={(e) => setExpectedEndDate(e.target.value)}
                                disabled={isPending}
                              />
                              {suggestedEndDate && expectedEndDate !== suggestedEndDate ? (
                                <button
                                  type="button"
                                  className="ds-hintbtn"
                                  onClick={() => setExpectedEndDate(suggestedEndDate)}
                                  disabled={isPending}
                                >
                                  Gợi ý: {formatDate(suggestedEndDate)} (≈{pkg} buổi, ~2 buổi/tuần —
                                  chỉnh nếu cần)
                                </button>
                              ) : null}
                            </label>
                          </div>
                          <label className="ds-field ds-field--wide" style={{ marginBottom: 12 }}>
                            Ghi chú nhân viên (tùy chọn)
                            <textarea
                              className="ds-input ds-input--full"
                              value={staffNote}
                              onChange={(e) => setStaffNote(e.target.value)}
                              disabled={isPending}
                              rows={2}
                            />
                          </label>
                          <div className="ds-btns">
                            <Button
                              buttonStyle="primary"
                              type="button"
                              disabled={isPending || !startDate}
                              onClick={() => handleApprove(row.id)}
                            >
                              {isPending ? 'Đang duyệt…' : `Xác nhận duyệt ${pkg} buổi`}
                            </Button>
                            <Button
                              buttonStyle="secondary"
                              type="button"
                              disabled={isPending}
                              onClick={closePanel}
                            >
                              Hủy
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {isActive && mode === 'reject' ? (
                    <tr key={`${row.id}-reject`}>
                      <td colSpan={6}>
                        <div className="ds-card">
                          <p className="ds-formtitle">Từ chối yêu cầu của {row.studentName}</p>
                          <label className="ds-field ds-field--wide" style={{ marginBottom: 12 }}>
                            Lý do từ chối (bắt buộc)
                            <textarea
                              className="ds-input ds-input--full"
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              disabled={isPending}
                              rows={3}
                              placeholder="Ví dụ: phụ huynh đổi ý / đã liên hệ chốt qua kênh khác…"
                            />
                          </label>
                          <div className="ds-btns">
                            <Button
                              buttonStyle="primary"
                              type="button"
                              disabled={isPending || !reason.trim()}
                              onClick={() => handleReject(row.id)}
                            >
                              {isPending ? 'Đang từ chối…' : 'Xác nhận từ chối'}
                            </Button>
                            <Button
                              buttonStyle="secondary"
                              type="button"
                              disabled={isPending}
                              onClick={closePanel}
                            >
                              Hủy
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
