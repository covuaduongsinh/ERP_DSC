import { describe, it, expect } from 'vitest';

import { holidayNameForDate, type HolidayRange } from '@/lib/operations/holidays';

// ─── Hàm THUẦN holidayNameForDate ───────────────────────────────────────────────
describe('holidayNameForDate — khớp ngày trong khoảng nghỉ', () => {
  const tet: HolidayRange = { name: 'Tết Nguyên đán', start: '2026-02-16', end: '2026-02-22' };
  const gioTo: HolidayRange = { name: 'Giỗ tổ', start: '2026-04-26', end: '2026-04-26' };
  const ranges = [tet, gioTo];

  it('ngày giữa khoảng ⇒ trả tên', () => {
    expect(holidayNameForDate('2026-02-18', ranges)).toBe('Tết Nguyên đán');
  });

  it('biên đầu và biên cuối (bao gồm) ⇒ trả tên', () => {
    expect(holidayNameForDate('2026-02-16', ranges)).toBe('Tết Nguyên đán');
    expect(holidayNameForDate('2026-02-22', ranges)).toBe('Tết Nguyên đán');
  });

  it('nghỉ 1 ngày (start=end) ⇒ khớp đúng ngày đó', () => {
    expect(holidayNameForDate('2026-04-26', ranges)).toBe('Giỗ tổ');
  });

  it('ngoài mọi khoảng ⇒ null', () => {
    expect(holidayNameForDate('2026-02-15', ranges)).toBeNull();
    expect(holidayNameForDate('2026-02-23', ranges)).toBeNull();
    expect(holidayNameForDate('2026-06-01', ranges)).toBeNull();
  });

  it('danh sách rỗng ⇒ null', () => {
    expect(holidayNameForDate('2026-02-18', [])).toBeNull();
  });
});
