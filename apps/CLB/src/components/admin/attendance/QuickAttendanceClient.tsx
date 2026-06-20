'use client'

import { Button } from '@payloadcms/ui'
import { useCallback, useState, useTransition } from 'react'
import type { ClassOption, ClassRosterRow } from '@/lib/operations/roster'
import type { QuickAttendanceStatus } from '@/lib/operations/quick-attendance'
import { fetchClassRoster, saveQuickAttendance } from '@/app/actions/quickAttendance'

export interface QuickAttendanceClientProps {
  classes: ClassOption[]
}

const STATUS_OPTIONS: { value: QuickAttendanceStatus; label: string }[] = [
  { value: 'co_mat', label: 'Có mặt' },
  { value: 'vang', label: 'Vắng' },
  { value: 'phep', label: 'Phép' },
]

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

export function QuickAttendanceClient({ classes }: QuickAttendanceClientProps) {
  const [classId, setClassId] = useState<number | ''>('')
  const [date, setDate] = useState<string>(todayInputValue())
  const [rows, setRows] = useState<ClassRosterRow[]>([])
  const [statuses, setStatuses] = useState<Record<number, QuickAttendanceStatus>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})
  const [loadingRoster, startLoadRoster] = useTransition()
  const [submitting, startSubmit] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const onPickClass = useCallback((value: string) => {
    setSuccess(null)
    setError(null)
    const id = value ? Number(value) : ''
    setClassId(id)
    setRows([])
    setStatuses({})
    setNotes({})
    if (!id) return
    startLoadRoster(async () => {
      const res = await fetchClassRoster(id as number)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setRows(res.rows)
      // Mặc định "Có mặt" cho cả lớp — nhân viên chỉ sửa ai vắng/phép.
      const init: Record<number, QuickAttendanceStatus> = {}
      for (const r of res.rows) init[r.studentId] = 'co_mat'
      setStatuses(init)
    })
  }, [])

  const setStatus = useCallback((studentId: number, status: QuickAttendanceStatus) => {
    setStatuses((prev) => ({ ...prev, [studentId]: status }))
  }, [])

  const setNote = useCallback((studentId: number, note: string) => {
    setNotes((prev) => ({ ...prev, [studentId]: note }))
  }, [])

  const onSubmit = useCallback(() => {
    if (!classId || rows.length === 0) return
    setError(null)
    setSuccess(null)
    startSubmit(async () => {
      const entries = rows.map((r) => ({
        studentId: r.studentId,
        status: statuses[r.studentId] ?? 'co_mat',
        note: notes[r.studentId] ?? undefined,
      }))
      const res = await saveQuickAttendance({
        classId: classId as number,
        date,
        entries,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      setSuccess(
        `Đã ghi điểm danh: ${res.created} mới, ${res.updated} cập nhật (${rows.length} học viên).`,
      )
    })
  }, [classId, date, notes, rows, statuses])

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

      <div className="ds-formrow">
        <label className="ds-field">
          Lớp
          <select
            className="ds-select"
            value={classId}
            onChange={(e) => onPickClass(e.target.value)}
            disabled={loadingRoster || submitting}
          >
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.location ? ` (${c.location})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-field">
          Ngày học
          <input
            className="ds-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={submitting}
          />
        </label>
      </div>

      {loadingRoster ? <p className="ds-muted">Đang tải sĩ số…</p> : null}

      {!loadingRoster && classId && rows.length === 0 ? (
        <p className="ds-muted">
          Lớp này chưa có học viên đang học (hoặc ngoài phạm vi cơ sở của bạn).
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">Học viên</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Nhận xét (tùy chọn)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      {r.fullName}
                      {typeof r.sessionsRemaining === 'number' ? (
                        <div className="ds-cellsub">Còn {r.sessionsRemaining} buổi</div>
                      ) : null}
                    </td>
                    <td>
                      <div className="ds-radiorow">
                        {STATUS_OPTIONS.map((opt) => (
                          <label key={opt.value} className="ds-radio">
                            <input
                              type="radio"
                              name={`status-${r.studentId}`}
                              checked={(statuses[r.studentId] ?? 'co_mat') === opt.value}
                              onChange={() => setStatus(r.studentId, opt.value)}
                              disabled={submitting}
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        className="ds-input ds-input--full"
                        type="text"
                        value={notes[r.studentId] ?? ''}
                        onChange={(e) => setNote(r.studentId, e.target.value)}
                        disabled={submitting}
                        placeholder="…"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 16 }}>
            <Button buttonStyle="primary" type="button" disabled={submitting} onClick={onSubmit}>
              {submitting ? 'Đang ghi…' : `Ghi điểm danh (${rows.length} HV)`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
