import 'server-only';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';

/**
 * Thống kê dạy (GĐ5) — đếm buổi theo GV và theo lớp trong một cửa sổ thời gian,
 * từ collection `class-sessions` (đã branch-scope theo `location`). Phần đếm là
 * HÀM THUẦN (`aggregateTeaching`) để unit-test; lớp I/O nạp + resolve tên.
 *
 * GV của buổi = `coachThucTe` (GV thực dạy / dạy thay) ?? GV chính của lớp. Buổi
 * không xác định được GV gom vào nhóm "(chưa rõ GV)" (id 0).
 */

export interface SessionLite {
  lop: number | null;
  coachThucTe: number | null;
  trangThai: string;
}

export interface CoachStatRow {
  coachId: number;
  name: string;
  daDay: number;
  huy: number;
  bu: number;
  soLop: number;
}

export interface ClassStatRow {
  classId: number;
  title: string;
  daDay: number;
  huy: number;
  bu: number;
}

const NO_COACH = 0;

interface CoachAcc {
  daDay: number;
  huy: number;
  bu: number;
  lops: Set<number>;
}
interface ClassAcc {
  daDay: number;
  huy: number;
  bu: number;
}

/** Thuần: gom buổi theo GV (coachThucTe ?? GV lớp) và theo lớp. */
export function aggregateTeaching(
  sessions: SessionLite[],
  classCoach: Map<number, number | null>,
): { perCoach: Map<number, CoachAcc>; perClass: Map<number, ClassAcc> } {
  const perCoach = new Map<number, CoachAcc>();
  const perClass = new Map<number, ClassAcc>();

  const bump = (acc: { daDay: number; huy: number; bu: number }, trangThai: string) => {
    if (trangThai === 'da_day') acc.daDay += 1;
    else if (trangThai === 'huy') acc.huy += 1;
    else if (trangThai === 'bu') acc.bu += 1;
  };

  for (const s of sessions) {
    const coachId = s.coachThucTe ?? (s.lop != null ? classCoach.get(s.lop) ?? null : null) ?? NO_COACH;
    let c = perCoach.get(coachId);
    if (!c) {
      c = { daDay: 0, huy: 0, bu: 0, lops: new Set() };
      perCoach.set(coachId, c);
    }
    bump(c, s.trangThai);
    if (s.lop != null) c.lops.add(s.lop);

    if (s.lop != null) {
      let cl = perClass.get(s.lop);
      if (!cl) {
        cl = { daDay: 0, huy: 0, bu: 0 };
        perClass.set(s.lop, cl);
      }
      bump(cl, s.trangThai);
    }
  }
  return { perCoach, perClass };
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

export interface TeachingStats {
  weeks: number;
  fromISO: string;
  totalSessions: number;
  perCoach: CoachStatRow[];
  perClass: ClassStatRow[];
}

/** Nạp + đếm thống kê dạy trong `weeks` tuần gần nhất (branch-scoped). */
export async function loadTeachingStats(
  payload: Payload,
  user: User,
  weeks = 12,
): Promise<TeachingStats> {
  const w = Math.min(52, Math.max(1, Math.floor(weeks)));
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - w * 7);

  const { docs } = await payload.find({
    collection: 'class-sessions',
    where: { date: { greater_than_equal: from.toISOString() } },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
  });

  const sessions: SessionLite[] = docs.map((d) => ({
    lop: relId(d.lop),
    coachThucTe: relId(d.coachThucTe),
    trangThai: String(d.trangThai ?? ''),
  }));

  // Maps tên (nhãn — không nhạy cảm): classes (title + coach), coaches (name).
  const [classesRes, coachesRes] = await Promise.all([
    payload.find({ collection: 'classes', overrideAccess: true, depth: 0, pagination: false, limit: 0 }),
    payload.find({ collection: 'coaches', overrideAccess: true, depth: 0, pagination: false, limit: 0 }),
  ]);
  const classCoach = new Map<number, number | null>();
  const classTitle = new Map<number, string>();
  for (const c of classesRes.docs) {
    classCoach.set(c.id, relId(c.coach));
    classTitle.set(c.id, String(c.title ?? `Lớp #${c.id}`));
  }
  const coachName = new Map<number, string>();
  for (const co of coachesRes.docs) {
    coachName.set(co.id, String(co.hoTen ?? co.name ?? co.tenTat ?? `GV #${co.id}`));
  }

  const { perCoach, perClass } = aggregateTeaching(sessions, classCoach);

  const coachRows: CoachStatRow[] = [...perCoach.entries()]
    .map(([coachId, a]) => ({
      coachId,
      name: coachId === NO_COACH ? '(chưa rõ GV)' : coachName.get(coachId) ?? `GV #${coachId}`,
      daDay: a.daDay,
      huy: a.huy,
      bu: a.bu,
      soLop: a.lops.size,
    }))
    .sort((x, y) => y.daDay - x.daDay || y.bu - x.bu);

  const classRows: ClassStatRow[] = [...perClass.entries()]
    .map(([classId, a]) => ({
      classId,
      title: classTitle.get(classId) ?? `Lớp #${classId}`,
      daDay: a.daDay,
      huy: a.huy,
      bu: a.bu,
    }))
    .sort((x, y) => y.daDay - x.daDay);

  return { weeks: w, fromISO: from.toISOString(), totalSessions: sessions.length, perCoach: coachRows, perClass: classRows };
}
