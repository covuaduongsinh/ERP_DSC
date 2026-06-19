import 'server-only';
import type { Payload } from 'payload';
import type { Class, Coach, Location, User } from '@/payload-types';
import { isGlobalBranchUser, resolveBranchIds } from '../../access/branch';
import {
  findScheduleConflicts,
  type ScheduleConflict,
  type TimetableClass,
} from './schedule';

/**
 * Nạp dữ liệu THỜI KHÓA BIỂU (branch-scoped) + phát hiện trùng lịch.
 *
 * `classes.read = anyone` (không scope) ⇒ tự lọc theo cơ sở như `loadClassOptions`:
 * vai trò global thấy tất; bị-khóa chỉ thấy lớp cùng `location`; chưa gán ⇒ rỗng.
 * Lớp `trang_thai = da_dong` được loại khỏi phát hiện trùng (không còn hoạt động).
 */

type LichHocRow = NonNullable<Class['lichHoc']>[number];

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function coachOf(value: unknown): { id: number; name: string } | null {
  if (value && typeof value === 'object' && 'id' in value) {
    const c = value as Coach;
    if (typeof c.id === 'number') {
      const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : `GV #${c.id}`;
      return { id: c.id, name };
    }
  }
  return null;
}

export interface TimetableData {
  classes: TimetableClass[];
  conflicts: ScheduleConflict[];
}

export async function loadTimetable(payload: Payload, user: User): Promise<TimetableData> {
  const { docs } = await payload.find({
    collection: 'classes',
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    pagination: false,
    limit: 0,
    sort: 'title',
  });

  let rows = (docs as Class[]).map((c) => {
    const loc = c.location as Location | number | null | undefined;
    const locId = relId(loc);
    const locName = loc && typeof loc === 'object' ? loc.name : null;
    const coaches = [coachOf(c.coach), coachOf(c.troGiang)].filter(
      (x): x is { id: number; name: string } => x !== null,
    );
    const slots = Array.isArray(c.lichHoc)
      ? (c.lichHoc as LichHocRow[]).map((s) => ({
          thu: typeof s.thu === 'string' ? s.thu : '',
          gioBatDau: s.gioBatDau ?? '',
          gioKetThuc: s.gioKetThuc ?? '',
          phong: s.phong ?? null,
        }))
      : [];
    return {
      id: c.id,
      title: c.title,
      coaches,
      locationId: locId,
      locationName: locName ?? null,
      trangThai: (c.trangThai as string | null | undefined) ?? null,
      slots,
      _locId: locId,
    };
  });

  if (!isGlobalBranchUser(user)) {
    const branchIds = resolveBranchIds(user);
    rows = branchIds.length === 0 ? [] : rows.filter((r) => r._locId != null && branchIds.includes(r._locId));
  }

  const classes: TimetableClass[] = rows.map(({ _locId: _drop, ...r }) => r);
  const conflicts = findScheduleConflicts(classes.filter((c) => c.trangThai !== 'da_dong'));
  return { classes, conflicts };
}
