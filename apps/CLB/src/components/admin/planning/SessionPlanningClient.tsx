'use client'

import { Button } from '@payloadcms/ui'
import { useState, useTransition } from 'react'
import type { ClassOption } from '@/lib/operations/roster'
import type { PlanOutcome, PlannedSessionRow } from '@/lib/operations/session-planning'
import { ClassContentEditor } from '@/components/admin/feedback/ClassContentEditor'
import { StudentPlanTable } from './StudentPlanTable'
import {
  previewPlanAction,
  generatePlanAction,
  listPlannedSessionsAction,
  cancelPlannedSessionAction,
  createPlannedMakeupAction,
} from '@/app/actions/sessionPlanning'
import { ApplyTemplatePanel } from './ApplyTemplatePanel'

const THU_LABEL: Record<string, string> = {
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7: 'T7',
  cn: 'CN',
}
const TRANG_THAI_LABEL: Record<string, string> = {
  du_kien: 'Dự kiến',
  da_day: 'Đã dạy',
  huy: 'Hủy',
  bu: 'Dạy bù',
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  const dt = new Date(`${d}T00:00:00.000Z`)
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN')
}

/** YYYY-MM-DD theo local cho input type=date. */
function todayPlus(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function SessionPlanningClient({
  classes,
  canPlan,
}: {
  classes: ClassOption[]
  canPlan: boolean
}) {
  const [lopId, setLopId] = useState<number>(classes[0]?.id ?? 0)
  const [from, setFrom] = useState<string>(todayPlus(0))
  const [to, setTo] = useState<string>(todayPlus(27))

  const [preview, setPreview] = useState<{
    outcomes: PlanOutcome[]
    toCreate: number
    existing: number
    skipped: number
    note: string | null
  } | null>(null)
  const [sessions, setSessions] = useState<PlannedSessionRow[] | null>(null)
  const [openRow, setOpenRow] = useState<{
    id: number
    mode: 'content' | 'students' | 'makeup' | 'cancel'
  } | null>(null)

  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, startBusy] = useTransition()

  const refreshList = () =>
    new Promise<void>((resolve) => {
      startBusy(async () => {
        const res = await listPlannedSessionsAction({ lopId, from, to })
        if (res.ok) setSessions(res.rows)
        else setMsg({ kind: 'err', text: res.message })
        resolve()
      })
    })

  const onPreview = () => {
    setMsg(null)
    setPreview(null)
    startBusy(async () => {
      const res = await previewPlanAction({ lopId, from, to })
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setPreview({
        outcomes: res.outcomes,
        toCreate: res.toCreate,
        existing: res.existing,
        skipped: res.skipped,
        note: res.note,
      })
      if (res.note) setMsg({ kind: 'ok', text: res.note })
    })
  }

  const onGenerate = () => {
    setMsg(null)
    startBusy(async () => {
      const res = await generatePlanAction({ lopId, from, to })
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setMsg({
        kind: 'ok',
        text: `Đã sinh ${res.created} buổi dự kiến (bỏ qua ${res.existing} buổi đã có${
          res.skipped > 0 ? `, bỏ ${res.skipped} buổi trùng ngày nghỉ` : ''
        }).`,
      })
      setPreview(null)
      await refreshList()
    })
  }

  const onCancel = (row: PlannedSessionRow, reason: string) => {
    setMsg(null)
    startBusy(async () => {
      const res = await cancelPlannedSessionAction({ classId: lopId, date: row.date ?? '', reason })
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setMsg({ kind: 'ok', text: 'Đã hủy buổi.' })
      setOpenRow(null)
      await refreshList()
    })
  }

  const onMakeup = (row: PlannedSessionRow, date: string) => {
    setMsg(null)
    startBusy(async () => {
      const res = await createPlannedMakeupAction({
        classId: lopId,
        originalSessionId: row.sessionId,
        date,
      })
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message })
        return
      }
      setMsg({ kind: 'ok', text: 'Đã tạo buổi dạy bù.' })
      setOpenRow(null)
      await refreshList()
    })
  }

  // Rà soát & hủy hàng loạt buổi dự kiến đã LỠ sinh trùng ngày nghỉ.
  const onCancelHolidayConflicts = (conflicts: PlanOutcome[]) => {
    setMsg(null)
    startBusy(async () => {
      let cancelled = 0
      let failed = 0
      for (const o of conflicts) {
        const res = await cancelPlannedSessionAction({
          classId: lopId,
          date: o.date,
          reason: `Nghỉ lễ: ${o.holidayName ?? ''}`.trim(),
        })
        if (res.ok) cancelled += 1
        else failed += 1
      }
      setMsg({
        kind: failed > 0 ? 'err' : 'ok',
        text:
          failed > 0
            ? `Đã hủy ${cancelled} buổi; ${failed} buổi lỗi — thử lại.`
            : `Đã hủy ${cancelled} buổi trùng ngày nghỉ.`,
      })
      // Xem trước lại để cập nhật trạng thái + làm mới danh sách buổi.
      const pv = await previewPlanAction({ lopId, from, to })
      if (pv.ok)
        setPreview({
          outcomes: pv.outcomes,
          toCreate: pv.toCreate,
          existing: pv.existing,
          skipped: pv.skipped,
          note: pv.note,
        })
      await refreshList()
    })
  }

  // Buổi dự kiến đã lỡ sinh trùng ngày nghỉ (gợi ý rà soát & hủy).
  const holidayConflicts = preview
    ? preview.outcomes.filter((o) => o.status === 'holiday' && o.trangThai === 'du_kien')
    : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Bộ chọn lớp + khoảng ngày ─────────────────────────────────────── */}
      <fieldset
        style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12 }}
      >
        <legend style={{ padding: '0 6px', fontWeight: 600 }}>Chọn lớp &amp; khoảng ngày</legend>
        <div
          className="ds-formrow"
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label className="ds-field" style={{ flex: '1 1 240px' }}>
            Lớp
            <select
              className="ds-select"
              value={lopId}
              onChange={(e) => setLopId(Number(e.target.value))}
              disabled={busy}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                  {c.location ? ` · ${c.location}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="ds-field">
            Từ ngày
            <input
              className="ds-input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="ds-field">
            Đến ngày
            <input
              className="ds-input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              disabled={busy}
            />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              buttonStyle="secondary"
              type="button"
              disabled={busy || !lopId}
              onClick={onPreview}
            >
              {busy ? 'Đang xử lý…' : 'Kiểm tra (xem trước)'}
            </Button>
            <Button
              buttonStyle="secondary"
              type="button"
              disabled={busy || !lopId}
              onClick={() => {
                setMsg(null)
                void refreshList()
              }}
            >
              Tải danh sách buổi
            </Button>
          </div>
        </div>
        <p className="ds-muted" style={{ margin: '8px 0 0' }}>
          Buổi dự kiến chưa tính học phí — chỉ buổi có điểm danh “có mặt” mới trừ buổi.
        </p>
      </fieldset>

      {msg && (
        <p
          role={msg.kind === 'err' ? 'alert' : undefined}
          className={msg.kind === 'err' ? 'ds-error' : 'ds-success'}
          style={{ margin: 0 }}
        >
          {msg.text}
        </p>
      )}

      {/* ── Xem trước (dry-run) ─────────────────────────────────────────────── */}
      {preview && preview.outcomes.length > 0 && (
        <div className="ds-tbl-wrap">
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
            Xem trước: sẽ tạo <strong>{preview.toCreate}</strong> buổi mới, bỏ qua{' '}
            <strong>{preview.existing}</strong> buổi đã có
            {preview.skipped > 0 && (
              <>
                , bỏ <strong>{preview.skipped}</strong> buổi do trùng ngày nghỉ
              </>
            )}
            .
          </p>
          {canPlan && holidayConflicts.length > 0 && (
            <div
              role="alert"
              className="ds-error"
              style={{
                margin: '0 0 8px',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                Có {holidayConflicts.length} buổi dự kiến đã lỡ sinh trùng ngày nghỉ.
              </span>
              <Button
                buttonStyle="secondary"
                type="button"
                disabled={busy}
                onClick={() => onCancelHolidayConflicts(holidayConflicts)}
              >
                {busy ? 'Đang hủy…' : `Hủy ${holidayConflicts.length} buổi trùng nghỉ lễ`}
              </Button>
            </div>
          )}
          <table className="ds-tbl">
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col">Thứ</th>
                <th scope="col">Giờ</th>
                <th scope="col">Phòng</th>
                <th scope="col">Kết quả</th>
              </tr>
            </thead>
            <tbody>
              {preview.outcomes.map((o) => (
                <tr key={o.date}>
                  <td>{fmtDate(o.date)}</td>
                  <td>{THU_LABEL[o.thu] ?? o.thu}</td>
                  <td>
                    {o.gioBatDau}–{o.gioKetThuc}
                  </td>
                  <td>{o.phong ?? '—'}</td>
                  <td>
                    {o.status === 'create' ? (
                      <span className="ds-badge ds-badge--created">Sẽ tạo</span>
                    ) : o.status === 'holiday' ? (
                      <span className="ds-badge ds-badge--skipped">
                        Nghỉ lễ: {o.holidayName ?? '—'}
                        {o.trangThai === 'du_kien' ? ' (đã lỡ sinh)' : ''}
                      </span>
                    ) : (
                      <span className="ds-badge ds-badge--skipped">
                        Đã có ({TRANG_THAI_LABEL[o.trangThai ?? 'du_kien'] ?? o.trangThai})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {canPlan ? (
            <div style={{ marginTop: 12 }}>
              <Button
                buttonStyle="primary"
                type="button"
                disabled={busy || preview.toCreate === 0}
                onClick={onGenerate}
              >
                {busy ? 'Đang sinh…' : `Xác nhận sinh ${preview.toCreate} buổi dự kiến`}
              </Button>
            </div>
          ) : (
            <p
              role="alert"
              style={{ color: 'var(--theme-warning-600)', fontWeight: 600, marginTop: 12 }}
            >
              Chỉ quản lý hoặc admin mới được sinh buổi dự kiến. Bạn vẫn soạn được nội dung các buổi
              đã có.
            </p>
          )}
        </div>
      )}

      {/* ── Áp khung lộ trình (điền sẵn nội dung buổi) — chỉ admin/manager ───── */}
      {canPlan && lopId > 0 && (
        <ApplyTemplatePanel lopId={lopId} from={from} to={to} onApplied={refreshList} />
      )}

      {/* ── Danh sách buổi (sửa nội dung / hủy / bù) ────────────────────────── */}
      {sessions && (
        <div>
          <h2 style={{ margin: '0 0 8px' }}>Buổi trong khoảng ({sessions.length})</h2>
          {sessions.length === 0 ? (
            <p className="ds-muted">
              Chưa có buổi nào trong khoảng. Hãy xem trước rồi sinh buổi dự kiến.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sessions.map((s) => {
                const open = openRow?.id === s.sessionId ? openRow.mode : null
                return (
                  <div
                    key={s.sessionId}
                    style={{
                      border: '1px solid var(--theme-elevation-150)',
                      borderRadius: 6,
                      padding: 10,
                    }}
                  >
                    <div
                      style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <strong>{fmtDate(s.date)}</strong>
                      <span>{THU_LABEL[s.thu ?? ''] ?? s.thu ?? ''}</span>
                      <span>{s.gioBatDau ? `${s.gioBatDau}–${s.gioKetThuc ?? ''}` : ''}</span>
                      {s.phong && <span>P.{s.phong}</span>}
                      <span
                        className={`ds-badge ds-badge--${s.trangThai === 'huy' ? 'skipped' : 'created'}`}
                      >
                        {TRANG_THAI_LABEL[s.trangThai] ?? s.trangThai}
                      </span>
                      {s.buoiGocId && <span className="ds-muted">(bù cho #{s.buoiGocId})</span>}
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          className="ds-tbl__link"
                          onClick={() =>
                            setOpenRow(
                              open === 'content' ? null : { id: s.sessionId, mode: 'content' },
                            )
                          }
                        >
                          {open === 'content' ? 'Đóng' : 'Nội dung'}
                        </button>
                        <button
                          type="button"
                          className="ds-tbl__link"
                          onClick={() =>
                            setOpenRow(
                              open === 'students' ? null : { id: s.sessionId, mode: 'students' },
                            )
                          }
                        >
                          {open === 'students' ? 'Đóng' : 'Học viên'}
                        </button>
                        {canPlan && s.trangThai !== 'huy' && (
                          <button
                            type="button"
                            className="ds-tbl__link"
                            onClick={() =>
                              setOpenRow(
                                open === 'cancel' ? null : { id: s.sessionId, mode: 'cancel' },
                              )
                            }
                          >
                            Hủy buổi
                          </button>
                        )}
                        {canPlan && (
                          <button
                            type="button"
                            className="ds-tbl__link"
                            onClick={() =>
                              setOpenRow(
                                open === 'makeup' ? null : { id: s.sessionId, mode: 'makeup' },
                              )
                            }
                          >
                            Tạo bù
                          </button>
                        )}
                      </span>
                    </div>

                    {open === 'content' && (
                      <div style={{ marginTop: 10 }}>
                        <ClassContentEditor
                          sessionId={s.sessionId}
                          content={s.content}
                          enableTemplateFill
                        />
                      </div>
                    )}
                    {open === 'students' && <StudentPlanTable sessionId={s.sessionId} />}
                    {open === 'cancel' && (
                      <CancelForm
                        busy={busy}
                        onConfirm={(r) => onCancel(s, r)}
                        onClose={() => setOpenRow(null)}
                      />
                    )}
                    {open === 'makeup' && (
                      <MakeupForm
                        busy={busy}
                        onConfirm={(d) => onMakeup(s, d)}
                        onClose={() => setOpenRow(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CancelForm({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div
      style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <label className="ds-field" style={{ flex: '1 1 280px' }}>
        Lý do hủy
        <input
          className="ds-input ds-input--full"
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          disabled={busy}
          placeholder="VD: Nghỉ lễ, GV bận…"
        />
      </label>
      <Button buttonStyle="primary" type="button" disabled={busy} onClick={() => onConfirm(reason)}>
        {busy ? 'Đang hủy…' : 'Xác nhận hủy'}
      </Button>
      <Button buttonStyle="secondary" type="button" disabled={busy} onClick={onClose}>
        Đóng
      </Button>
    </div>
  )
}

function MakeupForm({
  busy,
  onConfirm,
  onClose,
}: {
  busy: boolean
  onConfirm: (date: string) => void
  onClose: () => void
}) {
  const [date, setDate] = useState(todayPlus(7))
  return (
    <div
      style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}
    >
      <label className="ds-field">
        Ngày dạy bù
        <input
          className="ds-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          disabled={busy}
        />
      </label>
      <Button
        buttonStyle="primary"
        type="button"
        disabled={busy || !date}
        onClick={() => onConfirm(date)}
      >
        {busy ? 'Đang tạo…' : 'Tạo buổi bù'}
      </Button>
      <Button buttonStyle="secondary" type="button" disabled={busy} onClick={onClose}>
        Đóng
      </Button>
    </div>
  )
}

export default SessionPlanningClient
