import type { Class } from '@/payload-types'
import { DAY_ORDER, type DayOfWeek } from '@/lib/operations/schedule'
import { getPayloadClient } from '@/lib/payload'
import { trackOrder, type ChessLevel, type TrackName } from '@/lib/roadmap'
import { levelOrder } from '@/lib/training'

/** Một buổi cố định hằng tuần — chỉ các trường an toàn để hiển thị công khai. */
export interface OpenClassSlot {
  thu: DayOfWeek
  gioBatDau: string
  gioKetThuc: string
}

/**
 * DTO CÔNG KHAI của một lớp đang mở. CỐ Ý chỉ chứa field được phép lộ ra website:
 * cấp độ, nhóm tuổi, tên lớp, cơ sở, lịch (ngày/giờ). KHÔNG chứa coach/troGiang/
 * phong/siSoToiDa — đó là dữ liệu vận hành nội bộ (rule bảo mật). Map sang DTO này
 * NGAY trong server (getOpenClasses) để các field nhạy cảm không lọt vào client payload.
 */
export interface OpenClassCard {
  id: number
  level: Class['level']
  track: Class['track']
  ageGroup: Class['ageGroup']
  title: string
  locationName: string | null
  schedule: OpenClassSlot[]
}

export interface OpenClassLevelGroup {
  level: ChessLevel
  classes: OpenClassCard[]
}

function toLocationName(location: Class['location']): string | null {
  if (!location || typeof location === 'number') return null
  return location.name ?? null
}

/** Lọc bỏ buổi thiếu thứ/giờ + sắp theo thứ trong tuần. THUẦN. */
function toSafeSlots(lichHoc: Class['lichHoc']): OpenClassSlot[] {
  if (!Array.isArray(lichHoc)) return []
  const slots: OpenClassSlot[] = []
  for (const slot of lichHoc) {
    const gioBatDau = slot.gioBatDau?.trim()
    const gioKetThuc = slot.gioKetThuc?.trim()
    if (!slot.thu || !gioBatDau || !gioKetThuc) continue
    slots.push({ thu: slot.thu, gioBatDau, gioKetThuc })
  }
  return slots.sort((a, b) => DAY_ORDER.indexOf(a.thu) - DAY_ORDER.indexOf(b.thu))
}

/**
 * Lớp đang mở (`trangThai = dang_mo`) → DTO sạch. Đọc qua Payload Local API trong
 * server; loại bỏ field nhạy cảm trước khi trả về cho component.
 */
export async function getOpenClasses(): Promise<OpenClassCard[]> {
  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'classes',
    where: { trangThai: { equals: 'dang_mo' } },
    depth: 1,
    limit: 200,
    sort: 'title',
  })

  return docs.map((doc) => ({
    id: doc.id,
    level: doc.level,
    track: doc.track,
    ageGroup: doc.ageGroup,
    title: doc.title,
    locationName: toLocationName(doc.location),
    schedule: toSafeSlots(doc.lichHoc),
  }))
}

/** Vị trí cấp nhỏ nhất của một lớp (để sắp lớp nhiều cấp); ∞ nếu không có cấp. */
function minLevelIndex(levels: OpenClassCard['level']): number {
  const idxs = (levels ?? []).map((level) => levelOrder.indexOf(level)).filter((i) => i >= 0)
  return idxs.length > 0 ? Math.min(...idxs) : Number.MAX_SAFE_INTEGER
}

/** Gom lớp theo 6 cấp (thứ tự @ds/brand.roadmap); lớp nhiều cấp xuất hiện ở mỗi cấp. THUẦN. */
export function groupOpenClassesByLevel(cards: OpenClassCard[]): OpenClassLevelGroup[] {
  return levelOrder
    .map((level) => ({
      level,
      classes: cards.filter((card) => card.level?.includes(level)),
    }))
    .filter((group) => group.classes.length > 0)
}

export interface OpenClassTrackGroup {
  track: TrackName
  classes: OpenClassCard[]
}

/**
 * Gom lớp theo 3 tuyến (thứ tự `trackOrder`) dùng field `track` lưu sẵn; lớp nhiều
 * tuyến xuất hiện ở mỗi tuyến. Trong mỗi tuyến sắp theo cấp nhỏ nhất; bỏ tuyến rỗng. THUẦN.
 */
export function groupOpenClassesByTrack(cards: OpenClassCard[]): OpenClassTrackGroup[] {
  return trackOrder
    .map((track) => ({
      track,
      classes: cards
        .filter((card) => card.track?.includes(track))
        .sort((a, b) => minLevelIndex(a.level) - minLevelIndex(b.level)),
    }))
    .filter((group) => group.classes.length > 0)
}
