import { describe, it, expect } from 'vitest';
import { aggregateTeaching, type SessionLite } from '@/lib/operations/teaching-stats';

describe('aggregateTeaching — đếm buổi theo GV + lớp (thuần)', () => {
  const classCoach = new Map<number, number | null>([[10, 99], [11, null]]);
  const sessions: SessionLite[] = [
    { lop: 10, coachThucTe: 5, trangThai: 'da_day' }, // GV 5, lớp 10
    { lop: 10, coachThucTe: null, trangThai: 'da_day' }, // fallback GV lớp = 99
    { lop: null, coachThucTe: 5, trangThai: 'bu' }, // GV 5, buổi lịch sử (không lớp)
    { lop: null, coachThucTe: null, trangThai: 'da_day' }, // (chưa rõ GV) = 0
    { lop: 11, coachThucTe: 5, trangThai: 'huy' }, // GV 5, lớp 11
    { lop: 10, coachThucTe: 5, trangThai: 'du_kien' }, // du_kien KHÔNG tính
  ];

  it('GV: coachThucTe ?? GV lớp; du_kien không tính; soLop = lớp khác nhau', () => {
    const { perCoach } = aggregateTeaching(sessions, classCoach);
    expect(perCoach.get(5)).toEqual({ daDay: 1, huy: 1, bu: 1, lops: new Set([10, 11]) });
    expect(perCoach.get(99)).toEqual({ daDay: 1, huy: 0, bu: 0, lops: new Set([10]) });
    expect(perCoach.get(0)).toEqual({ daDay: 1, huy: 0, bu: 0, lops: new Set() });
  });

  it('Lớp: chỉ buổi có lop; đếm theo trạng thái', () => {
    const { perClass } = aggregateTeaching(sessions, classCoach);
    expect(perClass.get(10)).toEqual({ daDay: 2, huy: 0, bu: 0 });
    expect(perClass.get(11)).toEqual({ daDay: 0, huy: 1, bu: 0 });
    expect(perClass.has(null as unknown as number)).toBe(false);
  });

  it('rỗng → maps rỗng', () => {
    const { perCoach, perClass } = aggregateTeaching([], classCoach);
    expect(perCoach.size).toBe(0);
    expect(perClass.size).toBe(0);
  });
});
