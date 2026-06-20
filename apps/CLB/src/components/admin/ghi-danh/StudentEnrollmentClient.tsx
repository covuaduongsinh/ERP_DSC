'use client'

import { Button } from '@payloadcms/ui'
import { useCallback, useMemo, useState, useTransition } from 'react'
import type { EnrollableStudent } from '@/lib/operations/roster'
import {
  DAY_SHORT,
  formatLichHoc,
  findTimeConflicts,
  type DayOfWeek,
  type ScheduleSlot,
} from '@/lib/operations/schedule'
import { fetchStudentEnrollment, saveStudentEnrollment } from '@/app/actions/studentEnrollment'

export interface EnrollClass {
  id: number
  title: string
  location: string | null
  slots: ScheduleSlot[]
}

export interface StudentEnrollmentClientProps {
  students: EnrollableStudent[]
  classes: EnrollClass[]
}

export function StudentEnrollmentClient({ students, classes }: StudentEnrollmentClientProps) {
  const [studentId, setStudentId] = useState<number | ''>('')
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [loading, startLoad] = useTransition()
  const [saving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes])

  // Nhóm lớp theo cơ sở để hiển thị checklist gọn.
  const groups = useMemo(() => {
    const m = new Map<string, EnrollClass[]>()
    for (const c of classes) {
      const key = c.location ?? 'Chưa gán cơ sở'
      const arr = m.get(key) ?? []
      arr.push(c)
      m.set(key, arr)
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'))
  }, [classes])

  const onPickStudent = useCallback((value: string) => {
    setError(null)
    setSuccess(null)
    const id = value ? Number(value) : ''
    setStudentId(id)
    setChecked(new Set())
    if (!id) return
    startLoad(async () => {
      const res = await fetchStudentEnrollment(id as number)
      if (!res.ok) {
        setError(res.message)
        return
      }
      setChecked(new Set(res.enrolledClassIds))
    })
  }, [])

  const toggle = useCallback((classId: number) => {
    setSuccess(null)
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(classId)) next.delete(classId)
      else next.add(classId)
      return next
    })
  }, [])

  // Cảnh báo mềm: các lớp ĐÃ TÍCH có trùng giờ không.
  const conflicts = useMemo(() => {
    const picked = [...checked]
      .map((id) => classById.get(id))
      .filter((c): c is EnrollClass => !!c)
      .map((c) => ({ id: c.id, title: c.title, slots: c.slots }))
    return findTimeConflicts(picked)
  }, [checked, classById])

  const onSave = useCallback(() => {
    if (!studentId) return
    setError(null)
    setSuccess(null)
    startSave(async () => {
      const res = await saveStudentEnrollment(studentId as number, [...checked])
      if (!res.ok) {
        setError(res.message)
        return
      }
      const parts = [`+${res.added} lớp`, `−${res.removed} lớp`]
      setSuccess(
        `Đã lưu ghi danh (${parts.join(', ')}).` +
          (res.errors.length > 0 ? ` Lưu ý: ${res.errors.join('; ')}` : ''),
      )
    })
  }, [studentId, checked])

  const busy = loading || saving

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
          Học viên
          <select
            className="ds-select"
            value={studentId}
            onChange={(e) => onPickStudent(e.target.value)}
            disabled={busy}
          >
            <option value="">— Chọn học viên —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <p className="ds-muted">Đang tải ghi danh…</p> : null}

      {studentId && !loading ? (
        <>
          {conflicts.length > 0 ? (
            <div className="ds-error" style={{ marginTop: 8 }}>
              ⚠ Trùng giờ giữa các lớp đã chọn (vẫn lưu được, kiểm tra lại):
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {conflicts.map((c, i) => (
                  <li key={i}>
                    {c.a.title} ↔ {c.b.title} ({DAY_SHORT[c.thu as DayOfWeek] ?? c.thu})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div style={{ marginTop: 12, display: 'grid', gap: 12 }}>
            {groups.map(([loc, items]) => (
              <fieldset
                key={loc}
                style={{
                  border: '1px solid var(--theme-elevation-150)',
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <legend style={{ padding: '0 6px', fontWeight: 600 }}>{loc}</legend>
                <div style={{ display: 'grid', gap: 6 }}>
                  {items.map((c) => {
                    const lich = formatLichHoc(c.slots)
                    return (
                      <label
                        key={c.id}
                        className="ds-radio"
                        style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked.has(c.id)}
                          onChange={() => toggle(c.id)}
                          disabled={busy}
                        />
                        <span>
                          {c.title}
                          {lich ? <span className="ds-cellsub"> — {lich}</span> : null}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <Button buttonStyle="primary" type="button" disabled={busy} onClick={onSave}>
              {saving ? 'Đang lưu…' : `Lưu ghi danh (${checked.size} lớp)`}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  )
}
