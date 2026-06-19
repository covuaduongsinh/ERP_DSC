import { getPayload, type Payload } from 'payload';
import config from '@/payload.config';
import { describe, it, beforeAll, expect } from 'vitest';
import type { User } from '@/payload-types';

/**
 * SMOKE RUNTIME branch-scope 🔒 (đóng "nợ verify" của Cụm 4).
 *
 * Pure-test `branch-access.int.spec.ts` đã chứng minh access function TRẢ ĐÚNG
 * `Where` ({ 'student.location': { in: [...] } }). File này chạy Payload THẬT trên
 * DB để chắc **Postgres dịch filter quan hệ lồng `student.location` đúng** — nhân
 * viên bị-khóa-cơ-sở KHÔNG đọc được dữ liệu HV cơ sở khác (read-only, không ghi).
 *
 * Dùng actor TỔNG HỢP (không persist): access chỉ đọc `collection/role/location`.
 */

const SCOPED_COLLECTIONS = [
  'attendance',
  'payments',
  'progress-reports',
  'tuition-cycles',
  'student-levels',
  'enrollments',
  'renewal-requests',
] as const;

let payload: Payload;
let locA: number | null = null;
let locB: number | null = null;

function coachAt(locationId: number | null): User {
  return { id: -1, collection: 'users', role: 'coach', location: locationId } as unknown as User;
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function studentIdOf(doc: unknown): number | null {
  if (doc && typeof doc === 'object' && 'student' in doc) {
    return relId((doc as { student: unknown }).student);
  }
  return null;
}

async function studentLocMap(ids: number[]): Promise<Map<number, number | null>> {
  const map = new Map<number, number | null>();
  if (ids.length === 0) return map;
  const { docs } = await payload.find({
    collection: 'students',
    where: { id: { in: ids } },
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 0,
  });
  for (const s of docs) {
    map.set((s as { id: number }).id, relId((s as { location: unknown }).location));
  }
  return map;
}

describe('Branch-scope RUNTIME smoke 🔒 (Postgres thực thi join student.location)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config });
    const { docs } = await payload.find({
      collection: 'locations',
      overrideAccess: true,
      limit: 2,
      depth: 0,
      sort: 'id',
    });
    locA = docs[0] ? (docs[0] as { id: number }).id : null;
    locB = docs[1] ? (docs[1] as { id: number }).id : null;
  });

  it('có ít nhất 1 cơ sở để test', () => {
    expect(locA).not.toBeNull();
  });

  for (const collection of SCOPED_COLLECTIONS) {
    it(`${collection}: coach khóa cơ sở A — mọi bản ghi trả về thuộc HV cơ sở A (không rò chéo)`, async () => {
      if (locA === null) return;
      const { docs } = await payload.find({
        collection,
        user: coachAt(locA),
        overrideAccess: false,
        depth: 0,
        pagination: false,
        limit: 300,
      });
      const ids = Array.from(
        new Set(docs.map(studentIdOf).filter((x): x is number => x !== null)),
      );
      const map = await studentLocMap(ids);
      for (const sid of ids) {
        expect(map.get(sid)).toBe(locA);
      }
    });
  }

  it('attendance: filtering THẬT xảy ra (scoped ≤ global; A + B ≤ global)', async () => {
    if (locA === null) return;
    const total = await payload.count({ collection: 'attendance', overrideAccess: true });
    const a = await payload.count({ collection: 'attendance', user: coachAt(locA), overrideAccess: false });
    expect(a.totalDocs).toBeLessThanOrEqual(total.totalDocs);
    if (locB !== null) {
      const b = await payload.count({ collection: 'attendance', user: coachAt(locB), overrideAccess: false });
      expect(a.totalDocs + b.totalDocs).toBeLessThanOrEqual(total.totalDocs);
    }
  });

  it('fail-closed: coach CHƯA gán cơ sở bị TỪ CHỐI (access=false ⇒ Forbidden)', async () => {
    // withBranchScope trả `false` ⇒ Payload chặn hẳn (Forbidden). App dùng
    // `disableErrors:true` để đổi thành rỗng; gọi thô thì NÉM lỗi — đều fail-closed.
    await expect(
      payload.find({
        collection: 'attendance',
        user: coachAt(null),
        overrideAccess: false,
        limit: 0,
      }),
    ).rejects.toThrow();
  });
});
