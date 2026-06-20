import type { RequiredDataFromCollectionSlug } from 'payload'
import type { Class } from '@/payload-types'

/** Hậu tố thêm vào tên lớp khi nhân bản (để phân biệt với lớp gốc). */
export const DUPLICATE_TITLE_SUFFIX = ' (bản sao)'

/** Lấy id quan hệ: depth:0 trả id thô; phòng khi populated thì lấy `.id`. */
function relId(value: number | { id: number } | null | undefined): number | null {
  if (value == null) return null
  return typeof value === 'number' ? value : value.id
}

/**
 * Dựng `data` để `create` một bản sao lớp từ một lớp nguồn (đọc ở `depth: 0`).
 *
 * - Bỏ `id` / `createdAt` / `updatedAt` (Payload tự sinh).
 * - Tên thêm hậu tố `(bản sao)`.
 * - `lichHoc`: strip `id` từng buổi để Payload sinh id mới.
 * - Copy đầy đủ cấu hình: cấp/tuyến/nhóm tuổi/cơ sở/GV/trợ giảng/sĩ số/trạng thái.
 *
 * KHÔNG đụng tới ghi danh (enrollments) hay buổi học (class_sessions) — đó là
 * collection riêng tham chiếu lớp theo id, không nằm trong document lớp.
 */
export function buildClassDuplicateData(doc: Class): RequiredDataFromCollectionSlug<'classes'> {
  return {
    title: `${doc.title}${DUPLICATE_TITLE_SUFFIX}`,
    level: doc.level ?? undefined,
    track: doc.track ?? undefined,
    ageGroup: doc.ageGroup,
    description: doc.description ?? undefined,
    location: relId(doc.location) as number,
    coach: relId(doc.coach),
    troGiang: relId(doc.troGiang),
    siSoToiDa: doc.siSoToiDa ?? undefined,
    trangThai: doc.trangThai ?? undefined,
    lichHoc: Array.isArray(doc.lichHoc)
      ? doc.lichHoc.map(({ id: _id, ...slot }) => slot)
      : undefined,
  }
}
