// KHÔNG `import 'server-only'`: module này được importer (enrollments/attendance)
// dùng cả ở Server Action lẫn script CLI (`payload run`). Nó chỉ chạy server-side
// (chỉ các importer server gọi tới), không lọt vào client bundle.
import type { Payload } from 'payload';
import { normalizePhone } from '@/lib/phone';

/**
 * Tìm học viên cho 1 dòng import theo thứ tự ưu tiên:
 *   1) `ma_hoc_vien` (id số) — chính xác nhất.
 *   2) `ho_ten` so khớp fullName (case-insensitive, không dấu). Nếu nhiều
 *      học viên trùng tên, BẮT BUỘC có `sdt_phu_huynh` để chốt qua quan hệ
 *      Parents.children.
 *
 * Trả về:
 *  - { ok: true, studentId } khi tìm thấy duy nhất.
 *  - { ok: false, error } với thông điệp cụ thể để báo lên UI.
 */
export type StudentLookupArgs = {
  payload: Payload;
  studentCode?: string;
  fullName?: string;
  parentPhone?: string;
};

export type StudentLookupResult =
  | { ok: true; studentId: number; matchedBy: 'id' | 'name' | 'name+phone' }
  | { ok: false; error: string; field?: string };

export async function lookupStudent(
  args: StudentLookupArgs,
): Promise<StudentLookupResult> {
  const { payload, studentCode, fullName, parentPhone } = args;

  // (1) Tìm theo ID nếu có
  if (studentCode) {
    const idNum = Number(studentCode);
    if (!Number.isInteger(idNum) || idNum <= 0) {
      return {
        ok: false,
        error: `Mã học viên "${studentCode}" không phải số nguyên dương.`,
        field: 'ma_hoc_vien',
      };
    }
    try {
      const found = await payload.findByID({
        collection: 'students',
        id: idNum,
        overrideAccess: true,
        depth: 0,
      });
      if (!found) {
        return {
          ok: false,
          error: `Không tìm thấy học viên có mã ${idNum}.`,
          field: 'ma_hoc_vien',
        };
      }
      return { ok: true, studentId: found.id as number, matchedBy: 'id' };
    } catch {
      return {
        ok: false,
        error: `Không tìm thấy học viên có mã ${idNum}.`,
        field: 'ma_hoc_vien',
      };
    }
  }

  // (2) Tìm theo họ tên
  if (!fullName || !fullName.trim()) {
    return {
      ok: false,
      error: 'Thiếu mã học viên hoặc họ tên.',
      field: 'ma_hoc_vien',
    };
  }

  // Payload Postgres dùng `like` không bỏ dấu — query theo equals trước,
  // nếu không có thì thử contains (cover viết hoa/thường).
  const byExact = await payload.find({
    collection: 'students',
    where: { fullName: { equals: fullName.trim() } },
    limit: 50,
    overrideAccess: true,
    depth: 0,
  });

  let candidates = byExact.docs;
  if (candidates.length === 0) {
    const byLike = await payload.find({
      collection: 'students',
      where: { fullName: { like: fullName.trim() } },
      limit: 50,
      overrideAccess: true,
      depth: 0,
    });
    candidates = byLike.docs;
  }

  if (candidates.length === 0) {
    return {
      ok: false,
      error: `Không tìm thấy học viên tên "${fullName}".`,
      field: 'ho_ten',
    };
  }

  if (candidates.length === 1) {
    return {
      ok: true,
      studentId: candidates[0].id as number,
      matchedBy: 'name',
    };
  }

  // Nhiều ứng viên → cần SĐT phụ huynh để chốt
  if (!parentPhone) {
    return {
      ok: false,
      error: `Có ${candidates.length} học viên trùng tên "${fullName}". Bổ sung cột sdt_phu_huynh để chốt đúng học viên.`,
      field: 'ho_ten',
    };
  }

  const phone = normalizePhone(parentPhone);
  const parent = await payload.find({
    collection: 'parents',
    where: { phone: { equals: phone } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  });
  if (parent.totalDocs === 0) {
    return {
      ok: false,
      error: `SĐT phụ huynh "${parentPhone}" chưa có trong hệ thống. Nhân viên cần tạo phụ huynh trước.`,
      field: 'sdt_phu_huynh',
    };
  }

  const parentDoc = parent.docs[0];
  const childIds = ((parentDoc.children ?? []) as Array<number | { id: number }>)
    .map((c) => (typeof c === 'number' ? c : c?.id))
    .filter((id): id is number => typeof id === 'number');

  const matches = candidates.filter((c) => childIds.includes(c.id as number));
  if (matches.length === 0) {
    return {
      ok: false,
      error: `Không có học viên tên "${fullName}" gắn với phụ huynh SĐT ${parentPhone}.`,
      field: 'sdt_phu_huynh',
    };
  }
  if (matches.length > 1) {
    return {
      ok: false,
      error: `Vẫn có ${matches.length} học viên trùng tên "${fullName}" thuộc phụ huynh này. Dùng mã học viên (ma_hoc_vien) để chốt.`,
      field: 'ho_ten',
    };
  }

  return {
    ok: true,
    studentId: matches[0].id as number,
    matchedBy: 'name+phone',
  };
}
