'use client'

import { Button } from '@payloadcms/ui'
import { useEffect, useMemo, useState, useTransition } from 'react'
import type { StudentPlanContent, StudentPlanRow } from '@/lib/operations/session-student-plans'
import {
  loadSessionStudentPlansAction,
  updateStudentPlanAction,
  applyClassPlanToAllAction,
} from '@/app/actions/sessionPlanning'

/**
 * Kế hoạch THEO TỪNG HỌC VIÊN trong một buổi. Hai chế độ xem: BẢNG (gọn, sửa inline
 * nhiều HV cùng lúc) và THẺ (rộng, 1 HV/khung). Ô trống ⇒ kế thừa nội dung cả lớp
 * (hiện ở placeholder). State form nâng lên component cha để chuyển Bảng/Thẻ giữ
 * nguyên giá trị đang gõ + làm "Lưu tất cả thay đổi" (chỉ dòng đã sửa).
 */

const FIELD_DEFS: { key: keyof StudentPlanContent; label: string; multiline: boolean }[] = [
  { key: 'mucTieu', label: 'Mục tiêu', multiline: true },
  { key: 'sachDangHoc', label: 'Sách đang học', multiline: false },
  { key: 'kienThucMoi', label: 'Kiến thức mới', multiline: true },
  { key: 'giaoBTVN', label: 'Giao BTVN', multiline: true },
  { key: 'khBuoiSau', label: 'Kế hoạch buổi sau', multiline: true },
]

type Form = {
  mucTieu: string
  sachDangHoc: string
  kienThucMoi: string
  giaoBTVN: string
  khBuoiSau: string
}
type FormMap = Record<number, Form>

function toForm(o: StudentPlanContent): Form {
  return {
    mucTieu: o.mucTieu ?? '',
    sachDangHoc: o.sachDangHoc ?? '',
    kienThucMoi: o.kienThucMoi ?? '',
    giaoBTVN: o.giaoBTVN ?? '',
    khBuoiSau: o.khBuoiSau ?? '',
  }
}

function formsFromRows(rows: StudentPlanRow[]): FormMap {
  const m: FormMap = {}
  for (const r of rows) m[r.studentId] = toForm(r.override)
  return m
}

function inheritPlaceholder(
  classContent: StudentPlanContent | null,
  key: keyof StudentPlanContent,
): string {
  const v = classContent?.[key]
  return v ? `Kế thừa: ${v}` : 'Kế thừa (cả lớp để trống)'
}

export function StudentPlanTable({ sessionId }: { sessionId: number }) {
  const [classContent, setClassContent] = useState<StudentPlanContent | null>(null)
  const [rows, setRows] = useState<StudentPlanRow[] | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const [view, setView] = useState<'table' | 'card'>('table')

  // State form nâng lên cha (đồng bộ cho cả 2 chế độ + Lưu tất cả).
  const [forms, setForms] = useState<FormMap>({})
  const [originals, setOriginals] = useState<FormMap>({})

  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, startBusy] = useTransition()

  const seed = (rs: StudentPlanRow[]) => {
    const f = formsFromRows(rs)
    setForms(f)
    setOriginals(formsFromRows(rs))
  }

  const reload = async () => {
    const res = await loadSessionStudentPlansAction(sessionId)
    if (!res.ok) {
      setMsg({ kind: 'err', text: res.message })
      setRows([])
      return
    }
    setClassContent(res.classContent)
    setRows(res.rows)
    setNote(res.note)
    seed(res.rows)
  }

  useEffect(() => {
    startBusy(reload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  const setField = (studentId: number, key: keyof Form, value: string) => {
    setForms((p) => ({ ...p, [studentId]: { ...p[studentId], [key]: value } }))
  }

  const isDirty = (studentId: number): boolean => {
    const a = forms[studentId]
    const b = originals[studentId]
    if (!a || !b) return false
    return (
      a.mucTieu !== b.mucTieu ||
      a.sachDangHoc !== b.sachDangHoc ||
      a.kienThucMoi !== b.kienThucMoi ||
      a.giaoBTVN !== b.giaoBTVN ||
      a.khBuoiSau !== b.khBuoiSau
    )
  }

  const dirtyIds = useMemo(
    () => (rows ?? []).map((r) => r.studentId).filter(isDirty),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, forms, originals],
  )

  const patchOf = (studentId: number) => {
    const f = forms[studentId]
    return {
      mucTieu: f.mucTieu || null,
      sachDangHoc: f.sachDangHoc || null,
      kienThucMoi: f.kienThucMoi || null,
      giaoBTVN: f.giaoBTVN || null,
      khBuoiSau: f.khBuoiSau || null,
    }
  }

  const saveOne = (studentId: number, fullName: string) => {
    setMsg(null)
    startBusy(async () => {
      const res = await updateStudentPlanAction({ sessionId, studentId, patch: patchOf(studentId) })
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setOriginals((p) => ({ ...p, [studentId]: { ...forms[studentId] } }))
      setMsg({ kind: 'ok', text: `Đã lưu kế hoạch cho ${fullName}.` })
    })
  }

  const saveAllDirty = () => {
    setMsg(null)
    const ids = dirtyIds
    if (ids.length === 0) return
    startBusy(async () => {
      let ok = 0
      let fail = 0
      const savedOriginals: FormMap = {}
      for (const studentId of ids) {
        const res = await updateStudentPlanAction({
          sessionId,
          studentId,
          patch: patchOf(studentId),
        })
        if (res.ok) {
          ok += 1
          savedOriginals[studentId] = { ...forms[studentId] }
        } else {
          fail += 1
        }
      }
      if (Object.keys(savedOriginals).length > 0) {
        setOriginals((p) => ({ ...p, ...savedOriginals }))
      }
      setMsg(
        fail === 0
          ? { kind: 'ok', text: `Đã lưu ${ok} học viên.` }
          : {
              kind: 'err',
              text: `Đã lưu ${ok} học viên; ${fail} dòng lỗi (có thể ngoài phạm vi cơ sở).`,
            },
      )
    })
  }

  const onApplyAll = () => {
    setMsg(null)
    startBusy(async () => {
      const res = await applyClassPlanToAllAction(sessionId)
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setMsg({ kind: 'ok', text: `Đã áp nội dung cả lớp cho ${res.affected} học viên.` })
      await reload()
    })
  }

  if (rows === null)
    return (
      <p className="ds-muted" style={{ margin: '8px 0' }}>
        Đang tải học viên…
      </p>
    )

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {msg && (
        <p
          role={msg.kind === 'err' ? 'alert' : undefined}
          className={msg.kind === 'err' ? 'ds-error' : 'ds-success'}
          style={{ margin: 0 }}
        >
          {msg.text}
        </p>
      )}
      {note && rows.length === 0 ? (
        <p className="ds-muted" style={{ margin: 0 }}>
          {note}
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <strong>Kế hoạch theo học viên ({rows.length})</strong>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <Button
                buttonStyle={view === 'table' ? 'primary' : 'secondary'}
                type="button"
                disabled={busy}
                onClick={() => setView('table')}
              >
                Bảng
              </Button>
              <Button
                buttonStyle={view === 'card' ? 'primary' : 'secondary'}
                type="button"
                disabled={busy}
                onClick={() => setView('card')}
              >
                Thẻ
              </Button>
            </span>
            <Button
              buttonStyle="primary"
              type="button"
              disabled={busy || dirtyIds.length === 0}
              onClick={saveAllDirty}
            >
              {busy
                ? 'Đang lưu…'
                : `Lưu tất cả thay đổi${dirtyIds.length ? ` (${dirtyIds.length})` : ''}`}
            </Button>
            <Button buttonStyle="secondary" type="button" disabled={busy} onClick={onApplyAll}>
              Áp nội dung cả lớp xuống tất cả HV
            </Button>
            <span className="ds-muted">Ô trống = kế thừa nội dung cả lớp (gợi ý mờ).</span>
          </div>

          {view === 'table' ? (
            <div className="ds-tbl-wrap">
              <table className="ds-tbl">
                <thead>
                  <tr>
                    <th scope="col" style={{ minWidth: 120 }}>
                      Học viên
                    </th>
                    {FIELD_DEFS.map((f) => (
                      <th key={f.key} scope="col" style={{ minWidth: 180 }}>
                        {f.label}
                      </th>
                    ))}
                    <th scope="col" style={{ width: 90 }}>
                      Lưu
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const dirty = isDirty(r.studentId)
                    return (
                      <tr
                        key={r.studentId}
                        style={dirty ? { background: 'var(--theme-elevation-50)' } : undefined}
                      >
                        <td style={{ fontWeight: 600, verticalAlign: 'top' }}>
                          {r.fullName}
                          {dirty && (
                            <span
                              className="ds-muted"
                              style={{ display: 'block', fontWeight: 400 }}
                            >
                              • chưa lưu
                            </span>
                          )}
                        </td>
                        {FIELD_DEFS.map((f) => (
                          <td key={f.key} style={{ verticalAlign: 'top' }}>
                            {f.multiline ? (
                              <textarea
                                className="ds-input ds-input--full"
                                rows={2}
                                value={forms[r.studentId]?.[f.key] ?? ''}
                                placeholder={inheritPlaceholder(classContent, f.key)}
                                onChange={(e) => setField(r.studentId, f.key, e.target.value)}
                                disabled={busy}
                              />
                            ) : (
                              <input
                                className="ds-input ds-input--full"
                                type="text"
                                value={forms[r.studentId]?.[f.key] ?? ''}
                                placeholder={inheritPlaceholder(classContent, f.key)}
                                onChange={(e) => setField(r.studentId, f.key, e.target.value)}
                                disabled={busy}
                              />
                            )}
                          </td>
                        ))}
                        <td style={{ verticalAlign: 'top' }}>
                          <Button
                            buttonStyle="primary"
                            type="button"
                            disabled={busy || !dirty}
                            onClick={() => saveOne(r.studentId, r.fullName)}
                          >
                            Lưu
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((r) => (
                <StudentCard
                  key={r.studentId}
                  row={r}
                  form={forms[r.studentId]}
                  classContent={classContent}
                  dirty={isDirty(r.studentId)}
                  busy={busy}
                  onField={(k, v) => setField(r.studentId, k, v)}
                  onSave={() => saveOne(r.studentId, r.fullName)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StudentCard({
  row,
  form,
  classContent,
  dirty,
  busy,
  onField,
  onSave,
}: {
  row: StudentPlanRow
  form: Form | undefined
  classContent: StudentPlanContent | null
  dirty: boolean
  busy: boolean
  onField: (key: keyof Form, value: string) => void
  onSave: () => void
}) {
  const f = form ?? { mucTieu: '', sachDangHoc: '', kienThucMoi: '', giaoBTVN: '', khBuoiSau: '' }
  return (
    <fieldset
      style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 10 }}
    >
      <legend style={{ padding: '0 6px', fontWeight: 600 }}>
        {row.fullName}
        {dirty ? ' • chưa lưu' : ''}
      </legend>
      <div className="ds-formrow" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label className="ds-field" style={{ flex: '1 1 100%' }}>
          Mục tiêu
          <textarea
            className="ds-input ds-input--full"
            rows={2}
            value={f.mucTieu}
            placeholder={inheritPlaceholder(classContent, 'mucTieu')}
            onChange={(e) => onField('mucTieu', e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div
        className="ds-formrow"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}
      >
        <label className="ds-field" style={{ flex: '1 1 220px' }}>
          Sách đang học
          <input
            className="ds-input ds-input--full"
            type="text"
            value={f.sachDangHoc}
            placeholder={inheritPlaceholder(classContent, 'sachDangHoc')}
            onChange={(e) => onField('sachDangHoc', e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="ds-field" style={{ flex: '1 1 220px' }}>
          Kiến thức mới
          <textarea
            className="ds-input ds-input--full"
            rows={2}
            value={f.kienThucMoi}
            placeholder={inheritPlaceholder(classContent, 'kienThucMoi')}
            onChange={(e) => onField('kienThucMoi', e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div
        className="ds-formrow"
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}
      >
        <label className="ds-field" style={{ flex: '1 1 220px' }}>
          Giao BTVN
          <textarea
            className="ds-input ds-input--full"
            rows={2}
            value={f.giaoBTVN}
            placeholder={inheritPlaceholder(classContent, 'giaoBTVN')}
            onChange={(e) => onField('giaoBTVN', e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="ds-field" style={{ flex: '1 1 220px' }}>
          Kế hoạch buổi sau
          <textarea
            className="ds-input ds-input--full"
            rows={2}
            value={f.khBuoiSau}
            placeholder={inheritPlaceholder(classContent, 'khBuoiSau')}
            onChange={(e) => onField('khBuoiSau', e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <Button buttonStyle="primary" type="button" disabled={busy || !dirty} onClick={onSave}>
          {busy ? 'Đang lưu…' : 'Lưu kế hoạch HV'}
        </Button>
      </div>
    </fieldset>
  )
}

export default StudentPlanTable
