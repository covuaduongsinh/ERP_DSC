import type { CollectionBeforeValidateHook } from 'payload'
import {
  getLevelsForTracks,
  getTracksForLevels,
  type ChessLevel,
  type TrackName,
} from '@/lib/roadmap'

export interface LevelTrackInput {
  level?: ChessLevel[] | null
  track?: TrackName[] | null
  /** Cấp vừa được người dùng thay đổi trong lần lưu này? (mặc định: có giá trị = đã đổi). */
  levelChanged?: boolean
  /** Tuyến vừa được người dùng thay đổi trong lần lưu này? */
  trackChanged?: boolean
}

export interface LevelTrackResult {
  level: ChessLevel[]
  track: TrackName[]
}

/** So sánh hai mảng theo TẬP (không phụ thuộc thứ tự / trùng lặp). THUẦN. */
export function sameMembers<T>(a: readonly T[], b: readonly T[]): boolean {
  const sa = new Set(a)
  const sb = new Set(b)
  if (sa.size !== sb.size) return false
  for (const x of sa) if (!sb.has(x)) return false
  return true
}

/**
 * Tự suy 2 CHIỀU Cấp ↔ Tuyến cho một lớp — theo FIELD VỪA THAY ĐỔI để hai bên luôn
 * nhất quán sau khi lưu (không còn trạng thái lệch):
 *  - cả hai trống ⇒ ném lỗi (lớp phải gắn ít nhất một Cấp hoặc một Tuyến);
 *  - vừa đổi Tuyến mà KHÔNG đổi Cấp (và Tuyến không rỗng) ⇒ Cấp suy lại từ Tuyến;
 *  - còn lại, nếu có Cấp ⇒ Tuyến LUÔN suy lại từ Cấp (gồm: vừa thêm/bớt Cấp, đổi cả hai,
 *    hoặc tạo mới chỉ có Cấp) — Cấp là nguồn sự thật;
 *  - nếu tới đây Cấp vẫn rỗng (chỉ có Tuyến) ⇒ Cấp suy từ Tuyến.
 * THUẦN ⇒ unit-test được, không phụ thuộc Payload runtime.
 */
export function resolveLevelTrack(input: LevelTrackInput): LevelTrackResult {
  const level = input.level ?? []
  const track = input.track ?? []
  const levelChanged = input.levelChanged ?? level.length > 0
  const trackChanged = input.trackChanged ?? track.length > 0

  if (level.length === 0 && track.length === 0) {
    throw new Error('Lớp phải có ít nhất một Cấp độ hoặc một Tuyến.')
  }

  // Người dùng vừa đổi Tuyến (không đụng Cấp) ⇒ Cấp bám theo Tuyến.
  if (trackChanged && !levelChanged && track.length > 0) {
    return { level: getLevelsForTracks(track), track: [...track] }
  }

  // Cấp là nguồn: Tuyến luôn suy lại từ Cấp (sửa lỗi Tuyến cũ bị giữ lại khi đổi Cấp).
  if (level.length > 0) {
    return { level: [...level], track: getTracksForLevels(level) }
  }

  // Chỉ có Tuyến (Cấp rỗng) ⇒ suy Cấp từ Tuyến.
  return { level: getLevelsForTracks(track), track: [...track] }
}

/**
 * Hook `beforeValidate` cho collection `classes`. Tính `prev` từ `originalDoc`, giá trị
 * hiệu lực = `data.X ?? prev` (partial update không gửi đủ field), và cờ `changed` để
 * biết người dùng vừa đổi bên nào ⇒ suy bên kia. CREATE: `originalDoc` undefined ⇒ prev=[]
 * ⇒ field có giá trị xem như đã đổi. Gán lại cả hai để luôn lưu nhất quán.
 */
export const syncLevelTrack: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const prevLevel = (originalDoc?.level ?? []) as ChessLevel[]
  const prevTrack = (originalDoc?.track ?? []) as TrackName[]
  const level = (data.level ?? prevLevel) as ChessLevel[]
  const track = (data.track ?? prevTrack) as TrackName[]
  const resolved = resolveLevelTrack({
    level,
    track,
    levelChanged: data.level !== undefined && !sameMembers(level, prevLevel),
    trackChanged: data.track !== undefined && !sameMembers(track, prevTrack),
  })
  data.level = resolved.level
  data.track = resolved.track
  return data
}
