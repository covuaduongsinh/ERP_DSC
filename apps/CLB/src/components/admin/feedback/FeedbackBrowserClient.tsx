'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useCallback, useTransition } from 'react'
import { TRACK_LABEL, trackOrder } from '@/lib/roadmap'
import type { ClassOption } from '@/lib/operations/roster'
import type {
  SessionListRow,
  StudentFeedbackListRow,
  LocationOption,
  CoachOption,
} from '@/lib/operations/session-feedback'
import { bulkUpdateSessionsAction, bulkDeleteSessionsAction } from '@/app/actions/sessionFeedback'

export interface FeedbackBrowserClientProps {
  sessions: SessionListRow[]
  students: StudentFeedbackListRow[]
  classes: ClassOption[]
  locations: LocationOption[]
  coaches: CoachOption[]
}

type Tab = 'session' | 'student'
type BulkOp = '' | 'location' | 'lop' | 'coach' | 'trogiang' | 'delete'

const PAGE_SIZE = 60

const THU_ORDER = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'] as const
const THU_LABEL: Record<string, string> = {
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
  cn: 'Chủ nhật',
}

const NONE = '__none__'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

export function FeedbackBrowserClient({
  sessions,
  students,
  classes,
  locations,
  coaches,
}: FeedbackBrowserClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('session')
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)

  // Bộ chọn "xem buổi theo lớp + ngày".
  const [classId, setClassId] = useState<number | ''>('')
  const [date, setDate] = useState<string>(todayInputValue())

  // Bộ lọc danh sách buổi.
  const [fCoSo, setFCoSo] = useState<string>('')
  const [fThu, setFThu] = useState<string>('')
  const [fNam, setFNam] = useState<string>('')
  const [fThang, setFThang] = useState<string>('')
  const [fLop, setFLop] = useState<string>('')
  const [fTuyen, setFTuyen] = useState<string>('')
  const [fGV, setFGV] = useState<string>('')
  const [fTG, setFTG] = useState<string>('')

  // Chọn hàng loạt + thao tác.
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [op, setOp] = useState<BulkOp>('')
  const [opValue, setOpValue] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [bulkMsg, setBulkMsg] = useState<string | null>(null)
  const [bulkErr, setBulkErr] = useState<string | null>(null)

  const resetPaging = () => setLimit(PAGE_SIZE)

  const yearOptions = useMemo(() => {
    const set = new Set<string>()
    for (const s of sessions) if (s.date) set.add(s.date.slice(0, 4))
    return Array.from(set).sort((a, b) => b.localeCompare(a))
  }, [sessions])

  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase()
    return sessions.filter((s) => {
      if (q) {
        const hit =
          s.label.toLowerCase().includes(q) ||
          (s.coachName ?? '').toLowerCase().includes(q) ||
          (s.location ?? '').toLowerCase().includes(q) ||
          (s.date ?? '').includes(q)
        if (!hit) return false
      }
      if (fCoSo) {
        if (fCoSo === NONE) {
          if (s.location) return false
        } else if (s.location !== fCoSo) return false
      }
      if (fThu && s.thu !== fThu) return false
      if (fNam && (s.date ?? '').slice(0, 4) !== fNam) return false
      if (fThang && (s.date ?? '').slice(5, 7) !== fThang) return false
      if (fLop) {
        if (fLop === NONE) {
          if (s.classId !== null) return false
        } else if (s.classId !== Number(fLop)) return false
      }
      if (fTuyen && !s.tuyen.includes(fTuyen)) return false
      if (fGV) {
        if (fGV === NONE) {
          if (s.coachId !== null) return false
        } else if (s.coachId !== Number(fGV)) return false
      }
      if (fTG) {
        if (fTG === NONE) {
          if (s.troGiangId !== null) return false
        } else if (s.troGiangId !== Number(fTG)) return false
      }
      return true
    })
  }, [sessions, query, fCoSo, fThu, fNam, fThang, fLop, fTuyen, fGV, fTG])

  const visibleStudents = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = students
    if (q)
      list = list.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) || (s.location ?? '').toLowerCase().includes(q),
      )
    return list
  }, [students, query])

  const rows = tab === 'session' ? visibleSessions : visibleStudents
  const shown = rows.slice(0, limit)

  // ── Chọn hàng loạt (chỉ buổi có sessionId) ──────────────────────────────
  const selectableIds = useMemo(
    () => visibleSessions.map((s) => s.sessionId).filter((id): id is number => id !== null),
    [visibleSessions],
  )
  const allVisibleSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))
  const selectedCount = selected.size

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const allOn = selectableIds.length > 0 && selectableIds.every((id) => next.has(id))
      if (allOn) for (const id of selectableIds) next.delete(id)
      else for (const id of selectableIds) next.add(id)
      return next
    })
  }, [selectableIds])

  const clearSelection = useCallback(() => {
    setSelected(new Set())
    setOp('')
    setOpValue('')
  }, [])

  const onTab = (t: Tab) => {
    setTab(t)
    setQuery('')
    resetPaging()
  }

  const clearFilters = () => {
    setQuery('')
    setFCoSo('')
    setFThu('')
    setFNam('')
    setFThang('')
    setFLop('')
    setFTuyen('')
    setFGV('')
    setFTG('')
    resetPaging()
  }
  const hasFilter =
    !!query || !!fCoSo || !!fThu || !!fNam || !!fThang || !!fLop || !!fTuyen || !!fGV || !!fTG

  const openClassDate = () => {
    if (!classId || !date) return
    router.push(`/admin/nhan-xet-buoi?class=${classId}&date=${date}`)
  }

  const runUpdate = (patch: {
    location?: number
    lop?: number
    coachThucTe?: number
    troGiangThucTe?: number
  }) => {
    setBulkMsg(null)
    setBulkErr(null)
    startTransition(async () => {
      const res = await bulkUpdateSessionsAction({ sessionIds: Array.from(selected), patch })
      if (res.ok) {
        setBulkMsg(res.message)
        clearSelection()
        router.refresh()
      } else {
        setBulkErr(res.message)
      }
    })
  }

  const runDelete = () => {
    setBulkMsg(null)
    setBulkErr(null)
    startTransition(async () => {
      const res = await bulkDeleteSessionsAction({
        sessionIds: Array.from(selected),
        confirm: true,
      })
      if (res.ok) {
        setBulkMsg(res.message)
        clearSelection()
        router.refresh()
      } else {
        setBulkErr(res.message)
      }
    })
  }

  const applyOp = () => {
    if (op === 'location' && opValue) runUpdate({ location: Number(opValue) })
    else if (op === 'lop' && opValue) runUpdate({ lop: Number(opValue) })
    else if (op === 'coach' && opValue) runUpdate({ coachThucTe: Number(opValue) })
    else if (op === 'trogiang' && opValue) runUpdate({ troGiangThucTe: Number(opValue) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ds-toolbar">
        <button
          type="button"
          className={'ds-chip ds-chip--btn' + (tab === 'session' ? ' is-on' : '')}
          onClick={() => onTab('session')}
        >
          Theo buổi dạy ({sessions.length})
        </button>
        <button
          type="button"
          className={'ds-chip ds-chip--btn' + (tab === 'student' ? ' is-on' : '')}
          onClick={() => onTab('student')}
        >
          Theo học viên ({students.length})
        </button>
        <input
          className="ds-input"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            resetPaging()
          }}
          placeholder={tab === 'session' ? 'Tìm lớp / mã buổi / GV…' : 'Tìm theo tên học viên…'}
          style={{ marginLeft: 'auto', minWidth: 220 }}
        />
      </div>

      {tab === 'session' && (
        <>
          <div
            className="ds-card"
            style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <label className="ds-field">
              Cơ sở
              <select
                className="ds-select"
                value={fCoSo}
                onChange={(e) => {
                  setFCoSo(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
                <option value={NONE}>(Chưa rõ)</option>
              </select>
            </label>
            <label className="ds-field">
              Thứ
              <select
                className="ds-select"
                value={fThu}
                onChange={(e) => {
                  setFThu(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {THU_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {THU_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              Năm
              <select
                className="ds-select"
                value={fNam}
                onChange={(e) => {
                  setFNam(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              Tháng
              <select
                className="ds-select"
                value={fThang}
                onChange={(e) => {
                  setFThang(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>
                    Tháng {Number(m)}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              Lớp
              <select
                className="ds-select"
                value={fLop}
                onChange={(e) => {
                  setFLop(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
                <option value={NONE}>(Chưa gắn lớp)</option>
              </select>
            </label>
            <label className="ds-field">
              Tuyến
              <select
                className="ds-select"
                value={fTuyen}
                onChange={(e) => {
                  setFTuyen(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {trackOrder.map((t) => (
                  <option key={t} value={TRACK_LABEL[t]}>
                    {TRACK_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              Giáo viên
              <select
                className="ds-select"
                value={fGV}
                onChange={(e) => {
                  setFGV(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NONE}>(Không có)</option>
              </select>
            </label>
            <label className="ds-field">
              Trợ giảng
              <select
                className="ds-select"
                value={fTG}
                onChange={(e) => {
                  setFTG(e.target.value)
                  resetPaging()
                }}
              >
                <option value="">— Tất cả —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value={NONE}>(Không có)</option>
              </select>
            </label>
            {hasFilter && (
              <button type="button" className="ds-chip ds-chip--btn" onClick={clearFilters}>
                Xóa lọc
              </button>
            )}
          </div>

          <div
            className="ds-card"
            style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
          >
            <label className="ds-field">
              Mở buổi theo lớp
              <select
                className="ds-select"
                value={classId}
                onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : '')}
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
              />
            </label>
            <button
              type="button"
              className="ds-chip ds-chip--btn"
              disabled={!classId}
              onClick={openClassDate}
            >
              Xem buổi này →
            </button>
          </div>
        </>
      )}

      {bulkMsg ? (
        <p aria-live="polite" className="ds-notice ds-notice--success">
          {bulkMsg}
        </p>
      ) : null}
      {bulkErr ? (
        <p role="alert" className="ds-error">
          {bulkErr}
        </p>
      ) : null}

      {/* Thanh thao tác hàng loạt */}
      {tab === 'session' && selectedCount > 0 ? (
        <div
          className="ds-card"
          style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}
        >
          <span className="ds-muted" style={{ alignSelf: 'center' }}>
            Đã chọn <strong>{selectedCount}</strong> buổi
          </span>
          <label className="ds-field">
            Thao tác
            <select
              className="ds-select"
              value={op}
              disabled={isPending}
              onChange={(e) => {
                setOp(e.target.value as BulkOp)
                setOpValue('')
              }}
            >
              <option value="">— Chọn thao tác —</option>
              <option value="location">Gán cơ sở</option>
              <option value="lop">Gán lớp (kèm tuyến)</option>
              <option value="coach">Gán GV thực dạy</option>
              <option value="trogiang">Gán trợ giảng thực dạy</option>
              <option value="delete">Xóa buổi…</option>
            </select>
          </label>

          {op === 'location' ? (
            <label className="ds-field">
              Cơ sở
              <select
                className="ds-select"
                value={opValue}
                disabled={isPending}
                onChange={(e) => setOpValue(e.target.value)}
              >
                <option value="">— Chọn cơ sở —</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {op === 'lop' ? (
            <label className="ds-field">
              Lớp
              <select
                className="ds-select"
                value={opValue}
                disabled={isPending}
                onChange={(e) => setOpValue(e.target.value)}
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
          ) : null}
          {op === 'coach' ? (
            <label className="ds-field">
              GV thực dạy
              <select
                className="ds-select"
                value={opValue}
                disabled={isPending}
                onChange={(e) => setOpValue(e.target.value)}
              >
                <option value="">— Chọn GV —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {op === 'trogiang' ? (
            <label className="ds-field">
              Trợ giảng thực dạy
              <select
                className="ds-select"
                value={opValue}
                disabled={isPending}
                onChange={(e) => setOpValue(e.target.value)}
              >
                <option value="">— Chọn trợ giảng —</option>
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {op === 'delete' ? (
            <div className="ds-notice ds-notice--warning" style={{ flexBasis: '100%' }}>
              <p className="ds-notice__title">
                Xóa {selectedCount} buổi (kèm toàn bộ điểm danh thuộc các buổi này)?
              </p>
              <p>Thao tác không thể hoàn tác. Dữ liệu điểm danh và nhận xét của các buổi sẽ mất.</p>
              <div className="ds-btnrow">
                <button
                  type="button"
                  className="ds-btn ds-btn--danger"
                  disabled={isPending}
                  onClick={runDelete}
                >
                  {isPending ? 'Đang xóa…' : `Xác nhận xóa ${selectedCount} buổi`}
                </button>
                <button
                  type="button"
                  className="ds-chip ds-chip--btn"
                  disabled={isPending}
                  onClick={() => setOp('')}
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="ds-chip ds-chip--btn"
                disabled={isPending || op === '' || !opValue}
                onClick={applyOp}
              >
                {isPending ? 'Đang áp dụng…' : 'Áp dụng'}
              </button>
              <button
                type="button"
                className="ds-chip ds-chip--btn"
                disabled={isPending}
                onClick={clearSelection}
              >
                Bỏ chọn
              </button>
            </>
          )}
        </div>
      ) : null}

      {tab === 'session' ? (
        <p className="ds-muted">
          Hiển thị {visibleSessions.length} / {sessions.length} buổi
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="ds-muted">Không có dữ liệu khớp bộ lọc.</p>
      ) : (
        <div className="ds-tbl-wrap">
          <table className="ds-tbl">
            {tab === 'session' ? (
              <>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 36 }}>
                      <input
                        type="checkbox"
                        aria-label="Chọn tất cả buổi đang lọc"
                        checked={allVisibleSelected}
                        onChange={toggleAllVisible}
                        disabled={isPending || selectableIds.length === 0}
                      />
                    </th>
                    <th scope="col">Ngày</th>
                    <th scope="col">Buổi / Lớp</th>
                    <th scope="col">Cơ sở</th>
                    <th scope="col">GV</th>
                    <th scope="col">Sĩ số</th>
                    <th scope="col">Có nhận xét</th>
                  </tr>
                </thead>
                <tbody>
                  {(shown as SessionListRow[]).map((s) => (
                    <tr key={s.key}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Chọn buổi ${s.label}`}
                          checked={s.sessionId !== null && selected.has(s.sessionId)}
                          onChange={() => s.sessionId !== null && toggleOne(s.sessionId)}
                          disabled={s.sessionId === null || isPending}
                        />
                      </td>
                      <td>{fmtDate(s.date)}</td>
                      <td>
                        <Link className="ds-tbl__link" href={s.href}>
                          {s.label}
                        </Link>
                      </td>
                      <td>{s.location ? <span className="ds-tag-loc">{s.location}</span> : '—'}</td>
                      <td>
                        {s.coachName ?? '—'}
                        {s.troGiangName ? (
                          <span
                            className="ds-muted"
                            style={{ display: 'block', fontSize: '0.85em' }}
                          >
                            TG: {s.troGiangName}
                          </span>
                        ) : null}
                      </td>
                      <td className="ds-tbl__num">{s.studentCount}</td>
                      <td className="ds-tbl__num">{s.feedbackCount}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th scope="col">Học viên</th>
                    <th scope="col">Cơ sở</th>
                    <th scope="col">Số buổi</th>
                    <th scope="col">Có nhận xét</th>
                    <th scope="col">Gần nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {(shown as StudentFeedbackListRow[]).map((s) => (
                    <tr key={s.studentId}>
                      <td>
                        <Link
                          className="ds-tbl__link"
                          href={`/admin/nhan-xet-buoi?student=${s.studentId}`}
                        >
                          {s.studentName}
                        </Link>
                      </td>
                      <td>{s.location ? <span className="ds-tag-loc">{s.location}</span> : '—'}</td>
                      <td className="ds-tbl__num">{s.sessionCount}</td>
                      <td className="ds-tbl__num">{s.feedbackCount}</td>
                      <td>{fmtDate(s.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
      )}

      {rows.length > limit && (
        <div>
          <button
            type="button"
            className="ds-chip ds-chip--btn"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            Xem thêm ({rows.length - limit} còn lại)
          </button>
        </div>
      )}
    </div>
  )
}

export default FeedbackBrowserClient
