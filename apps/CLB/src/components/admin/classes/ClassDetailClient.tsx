'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  GraduationCap,
  BookOpen,
  Users,
  Percent,
  NotebookPen,
  BatteryLow,
  AlertTriangle,
  ClipboardCheck,
  CalendarDays,
  Check,
  CalendarClock,
  ChevronRight,
  MessageSquareText,
  Pencil,
} from 'lucide-react'
import type { SessionBalanceFlag } from '@/lib/operations/session-balance'

interface LevelDisplay {
  label: string
  piece: string
  color: string
}

export interface ClassDetailData {
  id: number
  code: string | null
  title: string
  status: { label: string; tone: 'success' | 'warning' | 'muted' } | null
  levels: LevelDisplay[]
  locationName: string | null
  coachName: string | null
  troGiangName: string | null
  siSoHienTai: number | null
  siSoToiDa: number | null
  scheduleText: string
  curriculum: { title: string; lessons: string[] } | null
  doneCount: number
  attendanceAvg: number | null
  lowCount: number
  roster: {
    id: number
    name: string
    nickname: string | null
    age: number | null
    level: LevelDisplay | null
    sessionsLeft: number | null
    flag: SessionBalanceFlag
  }[]
  sessions: {
    id: number
    date: string
    time: string
    topic: string
    status: string
    present: number | null
    total: number | null
    mucTieu: string | null
    kienThucMoi: string | null
    giaoBTVN: string | null
    khBuoiSau: string | null
    sachDangHoc: string | null
    ghiChu: string | null
    coachThucTe: string | null
    phong: string | null
  }[]
}

const AVA_COLORS = ['#2b3990', '#2275b4', '#3dbb95', '#2da44a', '#7a5af8', '#1e2a6b']
function initials(name: string): string {
  const parts = name
    .replace(/^(Chị|Anh|Bé|Em)\s+/i, '')
    .trim()
    .split(/\s+/)
  const a = parts[parts.length - 1]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 2][0] : ''
  return (a + b).toUpperCase() || '?'
}
function avaColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVA_COLORS[h % AVA_COLORS.length]
}

function Piece({ piece, size = 22 }: { piece: string; size?: number }) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/brand/pieces/${piece}.svg`}
      alt=""
      className="ds-piece"
      style={{ width: size, height: size }}
    />
  )
}

function LevelPill({ level }: { level: LevelDisplay }) {
  return (
    <span className="ds-lvl" style={{ background: level.color + '1a', color: level.color }}>
      <Piece piece={level.piece} size={15} /> {level.label}
    </span>
  )
}

function SessionMeter({ flag, left }: { flag: SessionBalanceFlag; left: number | null }) {
  if (flag === 'none') {
    return (
      <span className="ds-meter ds-meter--none">
        — <small>chưa có phiếu</small>
      </span>
    )
  }
  if (flag === 'negative') {
    return (
      <span className="ds-meter ds-meter--neg">
        <AlertTriangle aria-hidden /> <b>{left}</b> buổi
      </span>
    )
  }
  if (flag === 'low') {
    return (
      <span className="ds-meter ds-meter--low">
        <BatteryLow aria-hidden /> <b>{left}</b> buổi
      </span>
    )
  }
  return (
    <span className="ds-meter ds-meter--ok">
      <b>{left}</b> buổi
    </span>
  )
}

type SessionItem = ClassDetailData['sessions'][number]

function SessionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="ds-sessfield">
      <span className="ds-sessfield__l">{label}</span>
      <span className="ds-sessfield__v">{value}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'da_day')
    return (
      <span className="ds-badge ds-badge--success">
        <Check aria-hidden />
        Đã dạy
      </span>
    )
  if (status === 'bu') return <span className="ds-badge ds-badge--info">Học bù</span>
  if (status === 'huy') return <span className="ds-badge ds-badge--critical">Hủy</span>
  return (
    <span className="ds-badge ds-badge--muted">
      <CalendarClock aria-hidden />
      Dự kiến
    </span>
  )
}

function SessionRow({
  s,
  planned,
  open,
  onToggle,
  from,
}: {
  s: SessionItem
  planned: boolean
  open: boolean
  onToggle: () => void
  /** query string `from=…&from_label=…` để nút "Quay lại" về đúng tab. */
  from: string
}) {
  const fields: { label: string; value: string | null }[] = [
    { label: 'Mục tiêu', value: s.mucTieu },
    { label: 'Kiến thức mới', value: s.kienThucMoi },
    { label: 'Giao BTVN', value: s.giaoBTVN },
    { label: 'Kế hoạch buổi sau', value: s.khBuoiSau },
    { label: 'Sách đang học', value: s.sachDangHoc },
    { label: 'Ghi chú', value: s.ghiChu },
    { label: 'GV thực tế', value: s.coachThucTe },
    { label: 'Phòng', value: s.phong },
  ]
  const shown = fields.filter((f) => f.value)

  return (
    <>
      <tr
        className={
          'ds-tbl__rowclick' + (planned ? ' ds-tbl__rowmuted' : '') + (open ? ' is-open' : '')
        }
        onClick={onToggle}
        aria-expanded={open}
      >
        <td>
          <b className="ds-tnum">{s.date}</b> <span className="ds-tnum ds-muted">{s.time}</span>
        </td>
        <td>{s.topic}</td>
        <td>
          {s.total ? (
            <b
              className="ds-tnum"
              style={{ color: s.present === s.total ? 'var(--ds-green)' : undefined }}
            >
              {s.present}/{s.total}
            </b>
          ) : (
            <span className="ds-muted">—</span>
          )}
        </td>
        <td>
          <StatusBadge status={s.status} />
        </td>
        <td>
          <ChevronRight className={'ds-sesschev' + (open ? ' is-open' : '')} aria-hidden />
        </td>
      </tr>
      {open && (
        <tr className="ds-sessrow-detail">
          <td colSpan={5}>
            <div className="ds-sessdetail">
              {shown.length > 0 ? (
                <div className="ds-sessdetail__grid">
                  {shown.map((f) => (
                    <SessionField key={f.label} label={f.label} value={f.value as string} />
                  ))}
                </div>
              ) : (
                <p className="ds-muted ds-sessdetail__empty">
                  Chưa có nội dung buổi — bấm <b>Nội dung &amp; kế hoạch buổi</b> để soạn.
                </p>
              )}
              <div className="ds-sessactions">
                <Link
                  href={`/admin/nhan-xet-buoi?session=${s.id}&${from}`}
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                >
                  <MessageSquareText aria-hidden />
                  Nhận xét &amp; điểm danh
                </Link>
                <Link
                  href={`/admin/collections/class-sessions/${s.id}?${from}`}
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                >
                  <Pencil aria-hidden />
                  Nội dung &amp; kế hoạch buổi
                </Link>
                <Link
                  href={`/admin/diem-danh-nhanh?${from}`}
                  className="ds-btn ds-btn--ghost ds-btn--sm"
                >
                  <ClipboardCheck aria-hidden />
                  Điểm danh nhanh
                </Link>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export type ClassTabKey = 'students' | 'sessions' | 'curriculum'

export function ClassDetailClient({
  data,
  initialTab = 'students',
}: {
  data: ClassDetailData
  initialTab?: ClassTabKey
}) {
  const [tab, setTab] = useState<ClassTabKey>(initialTab)
  const [openSession, setOpenSession] = useState<number | null>(null)
  const primary = data.levels[0] ?? null
  const lessons = data.curriculum?.lessons ?? []

  // `from` (+nhãn) để trang đích hiện nút "Quay lại lớp học" về đúng tab.
  const fromFor = (t: ClassTabKey) =>
    `from=${encodeURIComponent(`/admin/lop/${data.id}?tab=${t}`)}&from_label=${encodeURIComponent('lớp học')}`

  return (
    <div className="ds-page">
      <Link href="/admin/collections/classes" className="ds-backlink">
        <ArrowLeft aria-hidden /> Danh sách lớp
      </Link>

      {/* Header */}
      <div className="ds-card ds-clshead">
        <span
          className="ds-clshead__pic"
          style={{ background: (primary?.color ?? '#2b3990') + '1a' }}
        >
          {primary ? <Piece piece={primary.piece} size={32} /> : <BookOpen aria-hidden />}
        </span>
        <div className="ds-clshead__main">
          <div className="ds-clshead__titlerow">
            <h1 className="ds-clshead__title">{data.title}</h1>
            {data.levels.map((lv) => (
              <LevelPill key={lv.label} level={lv} />
            ))}
            {data.locationName && <span className="ds-tag-loc">{data.locationName}</span>}
            {data.status && (
              <span className={`ds-badge ds-badge--${data.status.tone}`}>{data.status.label}</span>
            )}
            {data.code && <span className="ds-clshead__code">{data.code}</span>}
          </div>
          <div className="ds-clshead__meta">
            <span className="ds-kv">
              <Calendar aria-hidden />
              {data.scheduleText}
            </span>
            {data.coachName && (
              <span className="ds-kv">
                <GraduationCap aria-hidden />
                HLV {data.coachName}
                {data.troGiangName ? ` · TG ${data.troGiangName}` : ''}
              </span>
            )}
            {data.curriculum && (
              <span className="ds-kv">
                <BookOpen aria-hidden />
                Khung {data.curriculum.title} · {lessons.length} bài
              </span>
            )}
          </div>
        </div>
        <div className="ds-clshead__actions">
          <Link
            href={`/admin/lap-ke-hoach-lop?${fromFor('sessions')}`}
            className="ds-btn ds-btn--ghost"
          >
            <CalendarDays aria-hidden />
            Lập kế hoạch
          </Link>
          <Link
            href={`/admin/diem-danh-nhanh?${fromFor('sessions')}`}
            className="ds-btn ds-btn--primary"
          >
            <ClipboardCheck aria-hidden />
            Điểm danh
          </Link>
        </div>
      </div>

      {/* Statstrip */}
      <div className="ds-statstrip">
        <div className="ds-ministat">
          <div className="ds-ministat__l">
            <Users aria-hidden />
            Sĩ số
          </div>
          <div className="ds-ministat__v ds-tnum">
            {data.siSoHienTai ?? '—'} <small>/ {data.siSoToiDa ?? '—'}</small>
          </div>
        </div>
        <div className="ds-ministat">
          <div className="ds-ministat__l">
            <Percent aria-hidden />
            Chuyên cần TB
          </div>
          <div className="ds-ministat__v ds-tnum" style={{ color: 'var(--ds-green)' }}>
            {data.attendanceAvg !== null ? `${data.attendanceAvg}%` : '—'}
          </div>
        </div>
        <div className="ds-ministat">
          <div className="ds-ministat__l">
            <NotebookPen aria-hidden />
            Buổi đã học (khung)
          </div>
          <div className="ds-ministat__v ds-tnum">
            {data.doneCount} <small>/ {lessons.length || '—'}</small>
          </div>
        </div>
        <div className="ds-ministat">
          <div className="ds-ministat__l">
            <BatteryLow aria-hidden />
            HV cần chú ý buổi
          </div>
          <div
            className="ds-ministat__v ds-tnum"
            style={{ color: data.lowCount ? 'var(--ds-warning)' : 'var(--ds-green)' }}
          >
            {data.lowCount}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ds-tabs">
        <button
          type="button"
          className={tab === 'students' ? 'is-on' : ''}
          onClick={() => setTab('students')}
        >
          Học viên ({data.roster.length})
        </button>
        <button
          type="button"
          className={tab === 'sessions' ? 'is-on' : ''}
          onClick={() => setTab('sessions')}
        >
          Buổi học
        </button>
        <button
          type="button"
          className={tab === 'curriculum' ? 'is-on' : ''}
          onClick={() => setTab('curriculum')}
        >
          Khung lộ trình
        </button>
      </div>

      {tab === 'students' && (
        <div className="ds-panel">
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Cấp</th>
                  <th>Số buổi tồn</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.roster.length === 0 && (
                  <tr>
                    <td colSpan={4} className="ds-muted">
                      Chưa có học viên đang học trong lớp (hoặc ngoài phạm vi cơ sở của bạn).
                    </td>
                  </tr>
                )}
                {data.roster.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="ds-cellname">
                        <span className="ds-ava" style={{ background: avaColor(s.name) }}>
                          {initials(s.name)}
                        </span>
                        <div>
                          <b>{s.name}</b>
                          <div className="ds-cellname__sub">
                            {s.nickname ? `"${s.nickname}"` : ''}
                            {s.nickname && s.age !== null ? ' · ' : ''}
                            {s.age !== null ? `${s.age}t` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {s.level ? (
                        <LevelPill level={s.level} />
                      ) : (
                        <span className="ds-muted">—</span>
                      )}
                    </td>
                    <td>
                      <SessionMeter flag={s.flag} left={s.sessionsLeft} />
                    </td>
                    <td>
                      <Link
                        href={`/admin/so-buoi-ton?student=${s.id}&${fromFor('students')}`}
                        className="ds-rowlink"
                        title="Đối soát số buổi tồn"
                      >
                        <ChevronRight aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'sessions' && (
        <div className="ds-panel">
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th>Ngày · Giờ</th>
                  <th>Nội dung</th>
                  <th>Điểm danh</th>
                  <th>Trạng thái</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.sessions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="ds-muted">
                      Chưa có buổi học nào cho lớp này.
                    </td>
                  </tr>
                )}
                {data.sessions.map((s) => {
                  const planned = s.status === 'du_kien'
                  const open = openSession === s.id
                  return (
                    <SessionRow
                      key={s.id}
                      s={s}
                      planned={planned}
                      open={open}
                      onToggle={() => setOpenSession(open ? null : s.id)}
                      from={fromFor('sessions')}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'curriculum' && (
        <div className="ds-panel">
          <div className="ds-panel__head">
            <BookOpen aria-hidden className="ds-panel__ic" />
            <h2 className="ds-panel__t">
              {data.curriculum ? data.curriculum.title : 'Chưa gán khung lộ trình'}
            </h2>
            {data.curriculum && (
              <Link
                href={`/admin/soan-khung-lo-trinh?${fromFor('curriculum')}`}
                className="ds-btn ds-btn--ghost ds-btn--sm"
              >
                Soạn khung
              </Link>
            )}
          </div>
          {data.curriculum && (
            <div className="ds-currlist">
              {lessons.map((t, i) => {
                const state = i < data.doneCount ? 'done' : i === data.doneCount ? 'next' : 'todo'
                return (
                  <div key={i} className={`ds-currlesson ds-currlesson--${state}`}>
                    <span className="ds-currlesson__n">
                      {state === 'done' ? <Check aria-hidden /> : i + 1}
                    </span>
                    <span className="ds-currlesson__t">{t}</span>
                    {state === 'next' && (
                      <span className="ds-badge ds-badge--info ds-ml-auto">Buổi tới</span>
                    )}
                  </div>
                )
              })}
              {lessons.length === 0 && (
                <p className="ds-muted" style={{ padding: '8px 4px' }}>
                  Khung chưa có bài học.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ClassDetailClient
