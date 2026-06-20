import type { Payload } from 'payload'
import type { ClassSession, User } from '@/payload-types'
import { type DayOfWeek, type ScheduleSlot } from './schedule'

/**
 * Buổi học (class-sessions) — hàm sinh/lấy buổi THEO NHU CẦU từ lịch tuần của lớp.
 *
 * Phần THUẦN (sessionKey, expandSlotsForRange, weekdayToThu, formatUtcDate) tách
 * khỏi I/O để unit-test được (mẫu `schedule.ts`). `ensureSession` là lớp I/O mỏng
 * qua Local API — idempotent theo `khoaBuoi` (lop|YYYY-MM-DD, cột unique). Quy ước
 * NGÀY theo UTC-day, đồng bộ với `quick-attendance.ts` + `buildSessionsUsedWhere`.
 */

/** Đầu ngày dương lịch theo UTC (bỏ phần giờ) — đồng quy ước đếm buổi. */
export function toUtcDayStart(date: Date | string): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Định dạng YYYY-MM-DD theo UTC. */
export function formatUtcDate(date: Date | string): string {
  const d = new Date(date)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// getUTCDay: 0=CN, 1=T2, … 6=T7.
const WEEKDAY_TO_THU: DayOfWeek[] = ['cn', 't2', 't3', 't4', 't5', 't6', 't7']

/** Thứ trong tuần (t2..cn) của một ngày, theo UTC. */
export function weekdayToThu(date: Date | string): DayOfWeek {
  return WEEKDAY_TO_THU[new Date(date).getUTCDay()] ?? 'cn'
}

/** Khóa idempotent của buổi: `lop|YYYY-MM-DD` (UTC). */
export function sessionKey(lopId: number, date: Date | string): string {
  return `${lopId}|${formatUtcDate(date)}`
}

export interface ExpandedSlot {
  /** YYYY-MM-DD (UTC). */
  date: string
  thu: DayOfWeek
  gioBatDau: string
  gioKetThuc: string
  phong: string | null
}

/**
 * Bung lịch tuần (`lichHoc`) thành danh sách buổi cụ thể trong khoảng [from, to]
 * (bao gồm 2 đầu, theo ngày UTC). Mỗi slot khớp thứ → 1 buổi/ngày. THUẦN.
 */
export function expandSlotsForRange(
  lichHoc: ScheduleSlot[] | null | undefined,
  from: Date | string,
  to: Date | string,
): ExpandedSlot[] {
  if (!Array.isArray(lichHoc) || lichHoc.length === 0) return []
  const start = toUtcDayStart(from)
  const end = toUtcDayStart(to)
  if (end.getTime() < start.getTime()) return []

  const out: ExpandedSlot[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const thu = weekdayToThu(cursor)
    for (const slot of lichHoc) {
      if (slot.thu === thu) {
        out.push({
          date: formatUtcDate(cursor),
          thu,
          gioBatDau: slot.gioBatDau,
          gioKetThuc: slot.gioKetThuc,
          phong: slot.phong ?? null,
        })
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return out
}

/** Slot khớp với ngày (theo thứ); buổi đầu tiên cùng thứ nếu lớp học 2 ca cùng ngày. */
function matchSlotForDate(
  lichHoc: ScheduleSlot[] | null | undefined,
  date: Date | string,
): ScheduleSlot | null {
  if (!Array.isArray(lichHoc)) return null
  const thu = weekdayToThu(date)
  return lichHoc.find((s) => s.thu === thu) ?? null
}

/** Id quan hệ từ giá trị số hoặc object đã populate `{ id }`. */
function relId(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/**
 * Lấy buổi học của (lớp, ngày); tạo nếu chưa có. IDEMPOTENT qua `khoaBuoi`
 * (cột unique) — gọi nhiều lần chỉ 1 bản ghi.
 *
 * - Lookup `overrideAccess: true` CỐ Ý (idempotency KHÔNG phụ thuộc branch-scope;
 *   where khóa cứng theo `khoaBuoi` cụ thể nên không leak chéo — cùng lý do
 *   `quick-attendance`). Tạo với `overrideAccess:false + actor` nếu có actor (để
 *   collection access là hàng rào DB-level); nếu không có actor (backfill/hệ
 *   thống) thì overrideAccess:true.
 * - Snapshot slot (thu/giờ/phòng) từ `classes.lichHoc` theo giá trị tại thời điểm
 *   sinh — sửa lịch tuần sau này KHÔNG đổi buổi cũ.
 * - Bắt lỗi đua (unique `khoa_buoi`): tìm lại trả về thay vì ném.
 */
export async function ensureSession(
  payload: Payload,
  actor: User | null,
  input: { lopId: number; date: Date | string },
): Promise<ClassSession> {
  const day = toUtcDayStart(input.date)
  const khoaBuoi = sessionKey(input.lopId, day)

  const found = await payload.find({
    collection: 'class-sessions',
    where: { khoaBuoi: { equals: khoaBuoi } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  })
  if (found.docs.length > 0) return found.docs[0]

  // Đọc lớp để copy slot + cơ sở (best-effort; không có lịch vẫn tạo buổi trống).
  let slot: ScheduleSlot | null = null
  let locationId: number | null = null
  try {
    const cls = await payload.findByID({
      collection: 'classes',
      id: input.lopId,
      depth: 0,
      overrideAccess: true,
    })
    slot = matchSlotForDate(cls?.lichHoc, day)
    locationId = relId(cls?.location)
  } catch {
    slot = null
  }

  const data = {
    lop: input.lopId,
    date: day.toISOString(),
    thu: weekdayToThu(day),
    trangThai: 'du_kien' as const,
    khoaBuoi,
    ...(locationId !== null ? { location: locationId } : {}),
    ...(slot
      ? {
          gioBatDau: slot.gioBatDau,
          gioKetThuc: slot.gioKetThuc,
          ...(slot.phong ? { phong: slot.phong } : {}),
        }
      : {}),
  }

  try {
    return await payload.create({
      collection: 'class-sessions',
      data,
      user: actor ?? undefined,
      overrideAccess: !actor,
      depth: 0,
    })
  } catch (err) {
    // Đua tạo trùng khoaBuoi (unique) → tìm lại.
    const retry = await payload.find({
      collection: 'class-sessions',
      where: { khoaBuoi: { equals: khoaBuoi } },
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    if (retry.docs.length > 0) return retry.docs[0]
    throw err
  }
}
