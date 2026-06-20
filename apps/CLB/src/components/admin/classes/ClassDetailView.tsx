import Link from 'next/link'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { computeBalance } from '@/lib/operations/session-balance'
import { getPieceForLevel, levelFromCapChinh, type ChessLevel } from '@/lib/roadmap'
import { pieceForLevel } from '@/lib/chess'
import { ClassDetailClient, type ClassDetailData, type ClassTabKey } from './ClassDetailClient'

/**
 * HỒ SƠ LỚP HỌC (admin view — staff tool).
 *
 *  `/admin/lop/:id` → header lớp + statstrip + 3 tab (Học viên · Buổi học · Khung
 *  lộ trình). Đọc Local API (`overrideAccess:false` + user) ⇒ access control là
 *  hàng rào: roster/buổi học branch-scope theo `student.location`/`location`;
 *  lớp `read:anyone` nên header luôn hiện. Bám design/details.jsx → ClassDetail.
 */

/** Màu cấp (piece tint) — port từ design/data.js LEVELS (nhận diện, không brand token). */
const LEVEL_COLOR: Record<ChessLevel, string> = {
  tot: '#6B7280',
  ma: '#2275B4',
  tuong: '#3DBB95',
  xe: '#2DA44A',
  hau: '#7A5AF8',
  vua: '#2B3990',
}

const THU_LABEL: Record<string, string> = {
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7: 'T7',
  cn: 'CN',
}

const TRANG_THAI: Record<string, { label: string; tone: 'success' | 'warning' | 'muted' }> = {
  dang_mo: { label: 'Đang mở', tone: 'success' },
  tam_dung: { label: 'Tạm dừng', tone: 'warning' },
  da_dong: { label: 'Đã đóng', tone: 'muted' },
}

interface LevelDisplay {
  label: string
  piece: string
  color: string
}

function levelDisplay(slug: ChessLevel | null | undefined): LevelDisplay | null {
  if (!slug) return null
  return {
    label: getPieceForLevel(slug) || slug,
    piece: pieceForLevel(slug),
    color: LEVEL_COLOR[slug] ?? '#6B7280',
  }
}

function resolveId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function coachName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const c = value as { name?: unknown; hoTen?: unknown; tenTat?: unknown }
  return (
    (typeof c.name === 'string' && c.name) ||
    (typeof c.hoTen === 'string' && c.hoTen) ||
    (typeof c.tenTat === 'string' && c.tenTat) ||
    null
  )
}

function locationName(value: unknown): string | null {
  if (value && typeof value === 'object' && 'name' in value) {
    const n = (value as { name?: unknown }).name
    return typeof n === 'string' ? n : null
  }
  return null
}

function parseClassId(segments: unknown): number | null {
  if (!Array.isArray(segments) || segments.length === 0) return null
  const last = segments[segments.length - 1]
  const n = Number(last)
  return Number.isInteger(n) && n > 0 ? n : null
}

function ageFromDob(dob: unknown): number | null {
  if (typeof dob !== 'string' || !dob) return null
  const d = new Date(dob)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let age = now.getFullYear() - d.getFullYear()
  const m = now.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--
  return age >= 0 && age < 150 ? age : null
}

/** Ngày 'dd/mm/yyyy' (UTC) cho bảng buổi học. */
function fmtDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`
}

const common = { overrideAccess: false as const, disableErrors: true as const }

async function buildData(
  payload: Payload,
  user: User,
  classId: number,
): Promise<ClassDetailData | null> {
  const cls = await payload.findByID({
    collection: 'classes',
    id: classId,
    depth: 1,
    user,
    ...common,
  })
  if (!cls) return null

  const [enrRes, sessRes] = await Promise.all([
    payload.find({
      collection: 'enrollments',
      where: { and: [{ class: { equals: classId } }, { dangHoc: { equals: true } }] },
      depth: 2,
      limit: 0,
      pagination: false,
      user,
      ...common,
    }),
    payload.find({
      collection: 'class-sessions',
      where: { lop: { equals: classId } },
      depth: 1, // populate coachThucTe/troGiangThucTe (tên GV thực tế trong expand)
      limit: 0,
      pagination: false,
      sort: '-date', // mới → cũ: buổi dự kiến + vừa diễn ra lên trên
      user,
      ...common,
    }),
  ])

  const students = enrRes.docs
    .map((e) => (e as { student?: unknown }).student)
    .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
  const studentIds = students.map((s) => resolveId(s)).filter((id): id is number => id !== null)
  const sessionIds = sessRes.docs.map((s) => resolveId(s)).filter((id): id is number => id !== null)

  const levels = (cls.level ?? [])
    .map((slug) => levelDisplay(slug as ChessLevel))
    .filter((l): l is LevelDisplay => l !== null)
  const primaryLevel = (cls.level?.[0] as ChessLevel | undefined) ?? null

  const [payRes, attStudentRes, attSessionRes, currRes] = await Promise.all([
    studentIds.length
      ? payload.find({
          collection: 'payments',
          where: {
            and: [{ student: { in: studentIds } }, { tinhTrang: { equals: 'da_nop' } }],
          },
          depth: 0,
          limit: 0,
          pagination: false,
          select: { student: true, ngayNop: true, soBuoiNop: true },
          user,
          ...common,
        })
      : null,
    studentIds.length
      ? payload.find({
          collection: 'attendance',
          where: {
            and: [{ student: { in: studentIds } }, { status: { equals: 'co_mat' } }],
          },
          depth: 0,
          limit: 0,
          pagination: false,
          select: { student: true, date: true },
          user,
          ...common,
        })
      : null,
    sessionIds.length
      ? payload.find({
          collection: 'attendance',
          where: { session: { in: sessionIds } },
          depth: 0,
          limit: 0,
          pagination: false,
          select: { session: true, status: true },
          user,
          ...common,
        })
      : null,
    primaryLevel
      ? payload.find({
          collection: 'curriculum-templates',
          where: {
            and: [{ capDo: { equals: primaryLevel } }, { trangThai: { equals: 'dang_dung' } }],
          },
          depth: 0,
          limit: 1,
          user,
          ...common,
        })
      : null,
  ])

  // Gom phiếu thu + buổi học `co_mat` theo HV (tránh N+1) → số buổi tồn.
  const paysByStudent = new Map<number, { ngayNop: unknown; soBuoiNop: unknown }[]>()
  for (const p of payRes?.docs ?? []) {
    const sid = resolveId((p as { student?: unknown }).student)
    if (sid === null) continue
    const arr = paysByStudent.get(sid) ?? []
    arr.push({
      ngayNop: (p as { ngayNop?: unknown }).ngayNop,
      soBuoiNop: (p as { soBuoiNop?: unknown }).soBuoiNop,
    })
    paysByStudent.set(sid, arr)
  }
  const attByStudent = new Map<number, unknown[]>()
  for (const a of attStudentRes?.docs ?? []) {
    const sid = resolveId((a as { student?: unknown }).student)
    if (sid === null) continue
    const arr = attByStudent.get(sid) ?? []
    arr.push((a as { date?: unknown }).date)
    attByStudent.set(sid, arr)
  }

  // Điểm danh theo buổi → present/total cho tab Buổi học + chuyên cần TB.
  const attBySession = new Map<number, { present: number; total: number }>()
  for (const a of attSessionRes?.docs ?? []) {
    const sid = resolveId((a as { session?: unknown }).session)
    if (sid === null) continue
    const cur = attBySession.get(sid) ?? { present: 0, total: 0 }
    cur.total += 1
    if ((a as { status?: unknown }).status === 'co_mat') cur.present += 1
    attBySession.set(sid, cur)
  }

  // Roster + số buổi tồn theo HV.
  const roster: ClassDetailData['roster'] = students.map((s) => {
    const sid = resolveId(s) as number
    const result = computeBalance({
      openingBalance: (s.soBuoiTonDauKy as number | null | undefined) ?? null,
      openingDate: (s.ngayChotSoDu as string | null | undefined) ?? null,
      payments: (paysByStudent.get(sid) ?? []).map((p) => ({
        ngayNop: p.ngayNop as string | null | undefined,
        soBuoiNop: p.soBuoiNop as number | null | undefined,
      })),
      attendanceDates: (attByStudent.get(sid) ?? []) as (string | null | undefined)[],
    })
    return {
      id: sid,
      name: (typeof s.fullName === 'string' && s.fullName.trim()) || `#${sid}`,
      nickname: typeof s.nickname === 'string' ? s.nickname : null,
      age: ageFromDob(s.dob),
      level: levelDisplay(levelFromCapChinh(s.capChinh as never)),
      sessionsLeft: result.balance,
      flag: result.flag,
    }
  })

  // Buổi học: đã diễn ra (da_day/bu) + dự kiến (du_kien). Sắp mới→cũ.
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null)
  const sessions: ClassDetailData['sessions'] = sessRes.docs.map((s) => {
    const sid = resolveId(s) as number
    const att = attBySession.get(sid)
    const status = (s as { trangThai?: unknown }).trangThai
    const gioBatDau = (s as { gioBatDau?: unknown }).gioBatDau
    const gioKetThuc = (s as { gioKetThuc?: unknown }).gioKetThuc
    const time =
      typeof gioBatDau === 'string' && gioBatDau
        ? typeof gioKetThuc === 'string' && gioKetThuc
          ? `${gioBatDau}–${gioKetThuc}`
          : gioBatDau
        : ''
    const mucTieu = str((s as { mucTieu?: unknown }).mucTieu)
    const kienThucMoi = str((s as { kienThucMoi?: unknown }).kienThucMoi)
    return {
      id: sid,
      date: fmtDate((s as { date?: unknown }).date),
      time,
      topic: mucTieu || kienThucMoi || '—',
      status: typeof status === 'string' ? status : 'du_kien',
      present: att ? att.present : null,
      total: att ? att.total : null,
      mucTieu,
      kienThucMoi,
      giaoBTVN: str((s as { giaoBTVN?: unknown }).giaoBTVN),
      khBuoiSau: str((s as { khBuoiSau?: unknown }).khBuoiSau),
      sachDangHoc: str((s as { sachDangHoc?: unknown }).sachDangHoc),
      ghiChu: str((s as { ghiChuBuoi?: unknown }).ghiChuBuoi),
      coachThucTe: coachName((s as { coachThucTe?: unknown }).coachThucTe),
      phong: str((s as { phong?: unknown }).phong),
    }
  })

  const doneSessions = sessions.filter((s) => s.status === 'da_day' || s.status === 'bu')
  const doneCount = doneSessions.length

  // Chuyên cần TB qua các buổi đã diễn ra có điểm danh.
  const withAtt = doneSessions.filter((s) => s.total && s.total > 0)
  const attendanceAvg = withAtt.length
    ? Math.round(
        (withAtt.reduce((sum, s) => sum + (s.present ?? 0) / (s.total as number), 0) /
          withAtt.length) *
          100,
      )
    : null

  const lowCount = roster.filter((r) => r.flag === 'low' || r.flag === 'negative').length

  const currDoc = currRes?.docs?.[0] as
    | { tenKhung?: unknown; baiHoc?: { tieuDe?: unknown }[] }
    | undefined
  const curriculum = currDoc
    ? {
        title: typeof currDoc.tenKhung === 'string' ? currDoc.tenKhung : 'Khung lộ trình',
        lessons: (currDoc.baiHoc ?? []).map((b, i) =>
          typeof b.tieuDe === 'string' && b.tieuDe.trim() ? b.tieuDe : `Bài ${i + 1}`,
        ),
      }
    : null

  // Lịch học tuần (gộp thứ + 1 khung giờ tiêu biểu).
  const lichHoc = (cls.lichHoc ?? []) as {
    thu?: string
    gioBatDau?: string
    gioKetThuc?: string
    phong?: string
  }[]
  const days = Array.from(
    new Set(lichHoc.map((l) => (l.thu ? (THU_LABEL[l.thu] ?? l.thu) : '')).filter(Boolean)),
  )
  const firstTime = lichHoc.find((l) => l.gioBatDau)
  const scheduleParts = [...days]
  if (firstTime?.gioBatDau) {
    scheduleParts.push(
      firstTime.gioKetThuc ? `${firstTime.gioBatDau}–${firstTime.gioKetThuc}` : firstTime.gioBatDau,
    )
  }
  const scheduleText = scheduleParts.join(' · ') || 'Chưa xếp lịch'

  const tt = typeof cls.trangThai === 'string' ? (TRANG_THAI[cls.trangThai] ?? null) : null

  return {
    id: classId,
    code: typeof cls.code === 'string' ? cls.code : null,
    title: cls.title,
    status: tt,
    levels,
    locationName: locationName(cls.location),
    coachName: coachName(cls.coach),
    troGiangName: coachName(cls.troGiang),
    siSoHienTai: typeof cls.siSoHienTai === 'number' ? cls.siSoHienTai : roster.length,
    siSoToiDa: typeof cls.siSoToiDa === 'number' ? cls.siSoToiDa : null,
    scheduleText,
    curriculum,
    doneCount,
    attendanceAvg,
    lowCount,
    roster,
    sessions,
  }
}

export async function ClassDetailView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user || user.collection !== 'users') {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để xem hồ sơ lớp học.</p>
      </Gutter>
    )
  }

  const classId = parseClassId((params as { segments?: unknown } | undefined)?.segments)
  const tabRaw = Array.isArray(searchParams?.tab) ? searchParams?.tab[0] : searchParams?.tab
  const initialTab: ClassTabKey =
    tabRaw === 'sessions' || tabRaw === 'curriculum' ? tabRaw : 'students'

  let body: React.ReactNode
  if (classId === null) {
    body = <p>Đường dẫn lớp học không hợp lệ.</p>
  } else {
    const data = await buildData(payload, user as User, classId)
    body = data ? (
      <ClassDetailClient data={data} initialTab={initialTab} />
    ) : (
      <>
        <p style={{ marginBottom: 12 }}>
          <Link
            href="/admin/collections/classes"
            style={{ color: 'var(--theme-text)', textDecoration: 'underline' }}
          >
            ← Danh sách lớp
          </Link>
        </p>
        <p>Không tìm thấy lớp học (hoặc ngoài phạm vi cơ sở của bạn).</p>
      </>
    )
  }

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>{body}</Gutter>
    </DefaultTemplate>
  )
}

export default ClassDetailView
