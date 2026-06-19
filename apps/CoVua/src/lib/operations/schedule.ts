/**
 * Lịch học có cấu trúc — hàm THUẦN (không I/O): format + phát hiện trùng lịch.
 * Dùng chung cho màn Thời khóa biểu (admin) và thẻ lớp công khai. Unit-test được.
 */

export type DayOfWeek = 't2' | 't3' | 't4' | 't5' | 't6' | 't7' | 'cn';

export const DAY_ORDER: DayOfWeek[] = ['t2', 't3', 't4', 't5', 't6', 't7', 'cn'];

export const DAY_LABEL: Record<DayOfWeek, string> = {
  t2: 'Thứ 2',
  t3: 'Thứ 3',
  t4: 'Thứ 4',
  t5: 'Thứ 5',
  t6: 'Thứ 6',
  t7: 'Thứ 7',
  cn: 'Chủ nhật',
};

export const DAY_SHORT: Record<DayOfWeek, string> = {
  t2: 'T2',
  t3: 'T3',
  t4: 'T4',
  t5: 'T5',
  t6: 'T6',
  t7: 'T7',
  cn: 'CN',
};

export interface ScheduleSlot {
  thu: string;
  gioBatDau: string;
  gioKetThuc: string;
  phong?: string | null;
}

/** "HH:MM" → số phút trong ngày; null nếu sai định dạng. */
export function parseHm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Hai khoảng [aStart,aEnd) và [bStart,bEnd) có giao nhau không. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Hai buổi có trùng giờ không (cùng thứ + khoảng giờ giao nhau). */
export function slotsConflict(a: ScheduleSlot, b: ScheduleSlot): boolean {
  if (a.thu !== b.thu) return false;
  const as = parseHm(a.gioBatDau);
  const ae = parseHm(a.gioKetThuc);
  const bs = parseHm(b.gioBatDau);
  const be = parseHm(b.gioKetThuc);
  // Không parse được hoặc khoảng không hợp lệ ⇒ không kết luận trùng (tránh báo nhầm).
  if (as === null || ae === null || bs === null || be === null) return false;
  if (ae <= as || be <= bs) return false;
  return rangesOverlap(as, ae, bs, be);
}

/** Format mảng buổi → chuỗi đọc được, vd "T2 17:00–18:30 (A1) · T4 17:00–18:30". */
export function formatLichHoc(slots: ScheduleSlot[] | null | undefined): string {
  if (!Array.isArray(slots) || slots.length === 0) return '';
  const sorted = [...slots].sort((x, y) => {
    const dx = DAY_ORDER.indexOf(x.thu as DayOfWeek);
    const dy = DAY_ORDER.indexOf(y.thu as DayOfWeek);
    if (dx !== dy) return dx - dy;
    return (parseHm(x.gioBatDau) ?? 0) - (parseHm(y.gioBatDau) ?? 0);
  });
  return sorted
    .map((s) => {
      const day = DAY_SHORT[s.thu as DayOfWeek] ?? s.thu;
      const room = s.phong && s.phong.trim() ? ` (${s.phong.trim()})` : '';
      return `${day} ${s.gioBatDau}–${s.gioKetThuc}${room}`;
    })
    .join(' · ');
}

export interface TimetableClass {
  id: number;
  title: string;
  /** GV chính + trợ giảng (id + tên) — để phát hiện trùng GV. */
  coaches: Array<{ id: number; name: string }>;
  locationId: number | null;
  locationName: string | null;
  trangThai: string | null;
  slots: ScheduleSlot[];
}

export interface ScheduleConflict {
  kind: 'coach' | 'room';
  thu: string;
  a: { id: number; title: string };
  b: { id: number; title: string };
  /** Tên GV bị trùng, hoặc tên phòng bị trùng. */
  detail: string;
}

/**
 * Phát hiện trùng lịch giữa các lớp:
 *  - **GV**: hai lớp dùng CHUNG một người (GV chính/trợ giảng) ở buổi trùng giờ.
 *  - **Phòng**: hai lớp CÙNG cơ sở + CÙNG phòng ở buổi trùng giờ.
 */
export interface ClassSlots {
  id: number;
  title: string;
  slots: ScheduleSlot[];
}

export interface TimeConflict {
  a: { id: number; title: string };
  b: { id: number; title: string };
  /** Thứ trùng (một đại diện). */
  thu: string;
}

/**
 * Trùng GIỜ giữa các lớp (cho 1 HỌC VIÊN học nhiều lớp): hai lớp có buổi cùng
 * `thu` + giao giờ ⇒ HV không thể dự cả hai. Khác `findScheduleConflicts` (xét
 * trùng GV/phòng). Một cặp lớp chỉ báo MỘT lần. THUẦN.
 */
export function findTimeConflicts(classes: ClassSlots[]): TimeConflict[] {
  const out: TimeConflict[] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const A = classes[i];
      const B = classes[j];
      let hitThu: string | null = null;
      for (const sa of A.slots) {
        for (const sb of B.slots) {
          if (slotsConflict(sa, sb)) {
            hitThu = sa.thu;
            break;
          }
        }
        if (hitThu) break;
      }
      if (hitThu) {
        out.push({ a: { id: A.id, title: A.title }, b: { id: B.id, title: B.title }, thu: hitThu });
      }
    }
  }
  return out;
}

export function findScheduleConflicts(classes: TimetableClass[]): ScheduleConflict[] {
  const out: ScheduleConflict[] = [];
  for (let i = 0; i < classes.length; i++) {
    for (let j = i + 1; j < classes.length; j++) {
      const A = classes[i];
      const B = classes[j];
      for (const sa of A.slots) {
        for (const sb of B.slots) {
          if (!slotsConflict(sa, sb)) continue;

          const shared = A.coaches.filter((ca) => B.coaches.some((cb) => cb.id === ca.id));
          if (shared.length > 0) {
            out.push({
              kind: 'coach',
              thu: sa.thu,
              a: { id: A.id, title: A.title },
              b: { id: B.id, title: B.title },
              detail: shared.map((c) => c.name).join(', '),
            });
          }

          const roomA = sa.phong?.trim();
          const roomB = sb.phong?.trim();
          if (A.locationId != null && A.locationId === B.locationId && roomA && roomB && roomA === roomB) {
            out.push({
              kind: 'room',
              thu: sa.thu,
              a: { id: A.id, title: A.title },
              b: { id: B.id, title: B.title },
              detail: roomA,
            });
          }
        }
      }
    }
  }
  return out;
}
