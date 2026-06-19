import type { Payload } from 'payload';
import { formatUtcDate } from './sessions';

/**
 * LỊCH NGHỈ LỄ — lớp lọc dùng ở tầng LẬP KẾ HOẠCH buổi (`session-planning.ts`) để
 * bỏ qua ngày nghỉ khi sinh chuỗi buổi `du_kien`.
 *
 * Phần THUẦN (`holidayNameForDate`) tách khỏi I/O để unit-test. `loadHolidayRanges`
 * là lớp I/O mỏng. Quy ước NGÀY theo UTC-day (chuỗi YYYY-MM-DD) — đồng bộ với
 * `sessions.ts`/`expandSlotsForRange`.
 *
 * 🔒 `overrideAccess: true`: đây là logic hệ thống — PHẢI áp MỌI ngày nghỉ của cơ
 * sở lớp (toàn công ty + cơ sở đó), độc lập với branch của actor (giống cách
 * `ensureSession` đọc lớp). KHÔNG rò rỉ dữ liệu nhạy cảm: chỉ trả tên + khoảng ngày.
 */

/** Khoảng nghỉ đã chuẩn hóa — `start`/`end` là YYYY-MM-DD (UTC), bao gồm 2 đầu. */
export interface HolidayRange {
  name: string;
  start: string;
  end: string;
}

/** Số ngày nghỉ tối đa nạp ra (vài ngày lễ/năm ≪ trần này). */
const HOLIDAY_LIMIT = 200;

/** Mảng id cơ sở từ field relationship hasMany (depth:0 ⇒ số; phòng cả {id}). */
function locationIds(v: unknown): number[] {
  const arr = Array.isArray(v) ? v : v != null ? [v] : [];
  const out: number[] = [];
  for (const item of arr) {
    if (typeof item === 'number') out.push(item);
    else if (item && typeof item === 'object' && 'id' in item) {
      const id = (item as { id: unknown }).id;
      if (typeof id === 'number') out.push(id);
    }
  }
  return out;
}

/**
 * Nạp ngày nghỉ ĐANG BẬT áp dụng cho một cơ sở: ngày nghỉ toàn công ty
 * (`location` rỗng) + ngày nghỉ có cơ sở `locationId` nằm trong danh sách. Lọc cơ
 * sở + cửa sổ [from, to] TRONG BỘ NHỚ (số bản ghi ít) — `location` là quan hệ
 * hasMany nên không lọc qua `where` để tránh phụ thuộc toán tử `exists`/`in` trên
 * quan hệ nhiều. `from`/`to` = YYYY-MM-DD (UTC).
 */
export async function loadHolidayRanges(
  payload: Payload,
  locationId: number | null,
  from: string,
  to: string,
): Promise<HolidayRange[]> {
  const { docs } = await payload.find({
    collection: 'holidays',
    where: { kichHoat: { equals: true } },
    overrideAccess: true,
    depth: 0,
    limit: HOLIDAY_LIMIT,
  });

  const ranges: HolidayRange[] = [];
  for (const d of docs as unknown as Array<Record<string, unknown>>) {
    const tuNgay = d.tuNgay;
    if (typeof tuNgay !== 'string' && !(tuNgay instanceof Date)) continue;

    // Phạm vi cơ sở: rỗng = toàn công ty; ngược lại phải chứa cơ sở của lớp.
    const locs = locationIds(d.location);
    if (locs.length > 0 && (locationId == null || !locs.includes(locationId))) continue;

    const start = formatUtcDate(tuNgay as string | Date);
    // `denNgay` luôn được hook điền (= tuNgay nếu trống); thủ thân vẫn fallback.
    const denNgayRaw = d.denNgay;
    const end =
      typeof denNgayRaw === 'string' || denNgayRaw instanceof Date
        ? formatUtcDate(denNgayRaw as string | Date)
        : start;
    const name =
      typeof d.tenNgayNghi === 'string' && d.tenNgayNghi.trim() !== ''
        ? d.tenNgayNghi
        : 'Ngày nghỉ';
    // Chuẩn hóa thứ tự (phòng dữ liệu nhập ngược): start ≤ end.
    ranges.push(start <= end ? { name, start, end } : { name, start: end, end: start });
  }

  // Giao với cửa sổ [from, to] (so chuỗi ISO YYYY-MM-DD an toàn theo từ điển).
  return ranges.filter((r) => r.start <= to && r.end >= from);
}

/**
 * Tên ngày nghỉ nếu `date` (YYYY-MM-DD) rơi vào BẤT KỲ range nào; ngược lại null.
 * THUẦN — so chuỗi ISO. Trùng nhiều range → trả range khớp đầu tiên.
 */
export function holidayNameForDate(date: string, ranges: HolidayRange[]): string | null {
  for (const r of ranges) {
    if (r.start <= date && date <= r.end) return r.name;
  }
  return null;
}
