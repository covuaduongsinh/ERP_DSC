import { describe, it, expect } from 'vitest';
import { computePayroll } from '@/lib/operations/payroll';

const coaches = [
  { id: 1, name: 'Cô A', luongMoiBuoi: 100_000 },
  { id: 2, name: 'Thầy B', luongMoiBuoi: null }, // chưa set lương
  { id: 3, name: 'Cô C', luongMoiBuoi: 200_000 }, // có lương, không dạy
];

describe('computePayroll — số buổi distinct (ngày+lớp) × đơn giá', () => {
  it('gộp nhiều HV cùng (ngày, lớp) thành 1 buổi; lớp/ngày khác = buổi mới', () => {
    const att = [
      { coachId: 1, date: '2026-06-01T08:00:00Z', lop: 10 }, // buổi 1
      { coachId: 1, date: '2026-06-01T09:00:00Z', lop: 10 }, // cùng (ngày,lớp) → KHÔNG +
      { coachId: 1, date: '2026-06-01T08:00:00Z', lop: 11 }, // lớp khác cùng ngày → buổi 2
      { coachId: 1, date: '2026-06-03T08:00:00Z', lop: 10 }, // ngày khác → buổi 3
    ];
    const a = computePayroll(att, coaches).find((r) => r.coachId === 1)!;
    expect(a.soBuoi).toBe(3);
    expect(a.thanhTien).toBe(300_000);
  });

  it('GV chưa set lương ⇒ thành tiền 0 (luongMoiBuoi null)', () => {
    const b = computePayroll(
      [{ coachId: 2, date: '2026-06-01T08:00:00Z', lop: 5 }],
      coaches,
    ).find((r) => r.coachId === 2)!;
    expect(b.soBuoi).toBe(1);
    expect(b.luongMoiBuoi).toBeNull();
    expect(b.thanhTien).toBe(0);
  });

  it('không dạy: GV có lương vẫn liệt kê; GV chưa lương bị ẩn', () => {
    const rows = computePayroll([], coaches);
    expect(rows.find((r) => r.coachId === 3)).toBeTruthy(); // Cô C có lương
    expect(rows.find((r) => r.coachId === 2)).toBeUndefined(); // Thầy B 0 buổi + chưa lương
  });

  it('coachId null bị bỏ qua', () => {
    const rows = computePayroll(
      [{ coachId: null, date: '2026-06-01T08:00:00Z', lop: 1 }],
      coaches,
    );
    expect(rows.every((r) => r.soBuoi === 0)).toBe(true);
  });

  it('ngày sai định dạng bị bỏ qua', () => {
    const a = computePayroll(
      [{ coachId: 1, date: 'không-phải-ngày', lop: 10 }],
      coaches,
    ).find((r) => r.coachId === 1)!;
    expect(a.soBuoi).toBe(0);
  });
});
