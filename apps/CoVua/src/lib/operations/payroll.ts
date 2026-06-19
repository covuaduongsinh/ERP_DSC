import 'server-only';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';

/**
 * BẢNG LƯƠNG GIÁO VIÊN — tính theo BUỔI ĐỨNG LỚP.
 *
 * "Số buổi" = số buổi distinct GV đứng lớp trong kỳ = số cặp DISTINCT
 * `(ngày dương lịch, lớp)` từ `Attendance.coach` (gộp mọi HV cùng buổi → 1 buổi).
 * Thành tiền = số buổi × `Coaches.luongMoiBuoi`. Hàm `computePayroll` THUẦN để
 * unit-test; `loadPayroll` chỉ nạp dữ liệu (gọi với overrideAccess:false + user
 * vai trò tài chính ⇒ đọc đủ field lương đã khóa field-level).
 */

export interface PayrollAttendanceRow {
  coachId: number | null;
  date: string;
  lop: number | null;
}

export interface PayrollCoach {
  id: number;
  name: string;
  luongMoiBuoi: number | null;
}

export interface PayrollRow {
  coachId: number;
  name: string;
  luongMoiBuoi: number | null;
  soBuoi: number;
  thanhTien: number;
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

/** Ngày dương lịch UTC (yyyy-mm-dd) để gom buổi cùng ngày. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function computePayroll(
  attendance: PayrollAttendanceRow[],
  coaches: PayrollCoach[],
): PayrollRow[] {
  const sessionsByCoach = new Map<number, Set<string>>();
  for (const a of attendance) {
    if (a.coachId == null) continue;
    const day = dayKey(a.date);
    if (!day) continue;
    const key = `${day}|${a.lop ?? 'no-lop'}`;
    let set = sessionsByCoach.get(a.coachId);
    if (!set) {
      set = new Set();
      sessionsByCoach.set(a.coachId, set);
    }
    set.add(key);
  }

  return coaches
    .map((c) => {
      const soBuoi = sessionsByCoach.get(c.id)?.size ?? 0;
      const rate = typeof c.luongMoiBuoi === 'number' ? c.luongMoiBuoi : null;
      return {
        coachId: c.id,
        name: c.name,
        luongMoiBuoi: rate,
        soBuoi,
        thanhTien: rate != null ? soBuoi * rate : 0,
      };
    })
    // Bỏ GV vừa không dạy buổi nào vừa chưa set lương (không liên quan kỳ này).
    .filter((r) => r.soBuoi > 0 || r.luongMoiBuoi != null)
    .sort((a, b) => b.thanhTien - a.thanhTien || a.name.localeCompare(b.name, 'vi'));
}

export interface PayrollResult {
  rows: PayrollRow[];
  tongTien: number;
  tongBuoi: number;
}

export async function loadPayroll(
  payload: Payload,
  user: User,
  fromISO: string,
  toISO: string,
): Promise<PayrollResult> {
  const common = { user, overrideAccess: false, disableErrors: true, depth: 0, pagination: false, limit: 0 } as const;
  const [attRes, coachRes] = await Promise.all([
    payload.find({
      collection: 'attendance',
      where: { date: { greater_than_equal: fromISO, less_than_equal: toISO } },
      select: { coach: true, date: true, lop: true },
      ...common,
    }),
    payload.find({
      collection: 'coaches',
      select: { name: true, luongMoiBuoi: true },
      ...common,
    }),
  ]);

  const attendance: PayrollAttendanceRow[] = attRes.docs.map((d) => ({
    coachId: relId((d as { coach?: unknown }).coach),
    date: (d as { date: string }).date,
    lop: relId((d as { lop?: unknown }).lop),
  }));
  const coaches: PayrollCoach[] = coachRes.docs.map((d) => ({
    id: (d as { id: number }).id,
    name: (d as { name: string }).name,
    luongMoiBuoi:
      typeof (d as { luongMoiBuoi?: unknown }).luongMoiBuoi === 'number'
        ? ((d as { luongMoiBuoi: number }).luongMoiBuoi)
        : null,
  }));

  const rows = computePayroll(attendance, coaches);
  return {
    rows,
    tongTien: rows.reduce((s, r) => s + r.thanhTien, 0),
    tongBuoi: rows.reduce((s, r) => s + r.soBuoi, 0),
  };
}
