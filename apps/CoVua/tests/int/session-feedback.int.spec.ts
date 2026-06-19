import { describe, it, expect } from 'vitest';

import {
  groupAttendanceIntoSessions,
  weekdayCode,
  weekdayLocationName,
  type AttendanceLite,
} from '@/lib/operations/session-feedback';
import { bulkUpdateSessions, bulkDeleteSessions } from '@/lib/operations/sessions-bulk';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';

/**
 * Unit test (không cần DB) cho `groupAttendanceIntoSessions` — gom bản ghi
 * attendance thành "buổi dạy" theo khóa ưu tiên: session → buoi → lop+ngày →
 * coach+ngày. Kiểm tra studentCount (distinct) + feedbackCount (nhanXet ≠ rỗng).
 */

function row(p: Partial<AttendanceLite> & { id: number }): AttendanceLite {
  return {
    id: p.id,
    student: p.student ?? null,
    date: p.date ?? null,
    buoi: p.buoi ?? null,
    lop: p.lop ?? null,
    coach: p.coach ?? null,
    session: p.session ?? null,
    nhanXet: p.nhanXet ?? null,
  };
}

describe('groupAttendanceIntoSessions — khóa ưu tiên', () => {
  it('gom theo session FK (dữ liệu mới)', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, date: '2026-05-01', lop: 7, session: 99, nhanXet: 'tốt' }),
      row({ id: 2, student: 11, date: '2026-05-01', lop: 7, session: 99 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('session');
    expect(groups[0].sessionId).toBe(99);
    expect(groups[0].studentCount).toBe(2);
    expect(groups[0].feedbackCount).toBe(1);
    expect(groups[0].attendanceIds).toEqual([1, 2]);
  });

  it('gom theo mã buổi (dữ liệu lịch sử, không lớp/session)', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, date: '2026-01-10', buoi: 'C44', nhanXet: 'khá' }),
      row({ id: 2, student: 11, date: '2026-01-10', buoi: 'C44', nhanXet: 'tốt' }),
      row({ id: 3, student: 12, date: '2026-01-10', buoi: 'C44' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('buoi');
    expect(groups[0].buoi).toBe('C44');
    expect(groups[0].studentCount).toBe(3);
    expect(groups[0].feedbackCount).toBe(2);
  });

  it('gom theo lớp + ngày khi không có session lẫn mã buổi', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, date: '2026-03-02', lop: 5 }),
      row({ id: 2, student: 11, date: '2026-03-02', lop: 5 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('class-date');
    expect(groups[0].classId).toBe(5);
    expect(groups[0].date).toBe('2026-03-02');
  });

  it('fallback GV + ngày khi chỉ có coach + ngày', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, date: '2026-03-02', coach: 3 }),
      row({ id: 2, student: 11, date: '2026-03-02', coach: 3 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].kind).toBe('coach-date');
    expect(groups[0].coachId).toBe(3);
  });

  it('ưu tiên session hơn buoi (cùng tập bản ghi tách 2 nhóm)', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, date: '2026-05-01', buoi: 'C44', session: 99 }),
      row({ id: 2, student: 11, date: '2026-05-01', buoi: 'C44' }),
    ]);
    expect(groups).toHaveLength(2);
    const byKind = Object.fromEntries(groups.map((g) => [g.kind, g]));
    expect(byKind.session.sessionId).toBe(99);
    expect(byKind.buoi.buoi).toBe('C44');
  });

  it('đếm HV theo distinct (một HV nhiều bản ghi trong buổi chỉ tính 1)', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 10, buoi: 'B1' }),
      row({ id: 2, student: 10, buoi: 'B1', nhanXet: 'cập nhật' }),
    ]);
    expect(groups[0].studentCount).toBe(1);
    expect(groups[0].feedbackCount).toBe(1);
    expect(groups[0].attendanceIds).toEqual([1, 2]);
  });

  it('sắp xếp mới nhất trước; bản thiếu ngày xuống cuối', () => {
    const groups = groupAttendanceIntoSessions([
      row({ id: 1, student: 1, buoi: 'OLD', date: '2026-01-01' }),
      row({ id: 2, student: 2, buoi: 'NEW', date: '2026-12-31' }),
      row({ id: 3, student: 3, buoi: 'NODATE' }),
    ]);
    expect(groups.map((g) => g.buoi)).toEqual(['NEW', 'OLD', 'NODATE']);
  });
});

describe('weekdayCode / weekdayLocationName — suy cơ sở theo thứ', () => {
  // 2026-06-01 là Thứ 2 (Mon); cộng ngày để rảo qua tuần.
  const cases: { date: string; thu: string; loc: string | null }[] = [
    { date: '2026-06-01', thu: 't2', loc: 'Vĩnh Phúc' }, // Thứ 2
    { date: '2026-06-02', thu: 't3', loc: 'Kim Liên' }, // Thứ 3
    { date: '2026-06-03', thu: 't4', loc: null }, // Thứ 4
    { date: '2026-06-04', thu: 't5', loc: 'Kim Liên' }, // Thứ 5
    { date: '2026-06-05', thu: 't6', loc: 'Vĩnh Phúc' }, // Thứ 6
    { date: '2026-06-06', thu: 't7', loc: 'Kim Liên' }, // Thứ 7
    { date: '2026-06-07', thu: 'cn', loc: null }, // Chủ nhật
  ];

  for (const c of cases) {
    it(`${c.date} → ${c.thu} → ${c.loc ?? '(null)'}`, () => {
      expect(weekdayCode(c.date)).toBe(c.thu);
      expect(weekdayLocationName(c.date)).toBe(c.loc);
    });
  }

  it('ngày rỗng/không hợp lệ → null', () => {
    expect(weekdayCode(null)).toBeNull();
    expect(weekdayCode('không-phải-ngày')).toBeNull();
    expect(weekdayLocationName(null)).toBeNull();
  });
});

describe('bulk ops — gác cổng trước khi chạm DB', () => {
  // Payload giả: ném nếu bị gọi ⇒ chứng minh guard chặn TRƯỚC khi I/O.
  const throwingPayload = {
    update: () => {
      throw new Error('payload.update không được gọi');
    },
    delete: () => {
      throw new Error('payload.delete không được gọi');
    },
  } as unknown as Payload;
  const staff = { collection: 'users' } as unknown as User;

  it('từ chối khi không phải nhân viên', async () => {
    const res = await bulkUpdateSessions(throwingPayload, null, {
      sessionIds: [1],
      patch: { location: 2 },
    });
    expect(res).toMatchObject({ ok: false, error: 'forbidden' });
  });

  it('invalid_input khi chưa chọn buổi', async () => {
    const res = await bulkUpdateSessions(throwingPayload, staff, {
      sessionIds: [],
      patch: { location: 2 },
    });
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('invalid_input khi patch rỗng (không field nào)', async () => {
    const res = await bulkUpdateSessions(throwingPayload, staff, {
      sessionIds: [1],
      patch: {},
    });
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('invalid_input khi giá trị field không hợp lệ', async () => {
    const res = await bulkUpdateSessions(throwingPayload, staff, {
      sessionIds: [1],
      patch: { location: 0 },
    });
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('invalid_input khi troGiangThucTe không hợp lệ', async () => {
    const res = await bulkUpdateSessions(throwingPayload, staff, {
      sessionIds: [1],
      patch: { troGiangThucTe: -3 },
    });
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' });
  });

  it('xóa: bắt buộc confirm = true', async () => {
    const res = await bulkDeleteSessions(throwingPayload, staff, {
      sessionIds: [1],
      confirm: false,
    });
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' });
  });
});
