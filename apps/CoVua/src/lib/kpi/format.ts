import type { LeadSource } from './compute';

/**
 * Định dạng hiển thị cho trang Báo cáo KPI — THUẦN, unit-test được. Tách khỏi
 * compute để view (Server Component) và test dùng chung một nguồn.
 */

const VND = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/** Số tiền VND (vd 1.200.000 ₫). Giá trị không hợp lệ ⇒ 0 ₫. */
export function formatVnd(amount: number): string {
  return VND.format(Number.isFinite(amount) ? amount : 0);
}

/** Tỉ lệ 0..1 → phần trăm 1 chữ số thập phân; null/NaN ⇒ "—". */
export function formatPercent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}

/** Mốc tuần (Thứ Hai, UTC) → nhãn dd/mm để khớp lúc tính (tránh lệch múi giờ). */
export function formatWeekLabel(weekStart: Date): string {
  const dd = String(weekStart.getUTCDate()).padStart(2, '0');
  const mm = String(weekStart.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

/** Ngày (Date) → dd/mm/yyyy theo UTC. */
export function formatDateUtc(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Nhãn tiếng Việt cho nguồn lead. */
export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  google: 'Google',
  facebook: 'Facebook',
  gioi_thieu: 'Giới thiệu',
  khac: 'Khác',
};
