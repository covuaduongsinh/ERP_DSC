import type { Lead } from '@/payload-types';

/**
 * Tính KPI — lớp THUẦN (không I/O, `now` tiêm vào) cho trang Báo cáo KPI.
 *
 * Mọi hàm ở đây nhận dữ liệu thô (đã rút gọn từ payload-types) và trả số liệu;
 * không truy vấn DB ⇒ unit-test trực tiếp. Đây là nơi mã hóa ĐỊNH NGHĨA từng chỉ
 * số để "số khớp query thủ công" (xem tests/int/kpi-compute.int.spec.ts). Lớp
 * server-only `./report.ts` chỉ lo nạp dữ liệu rồi gọi các hàm này.
 *
 * Mốc thời gian dùng UTC nhất quán (không DST) ⇒ tất định và khớp `date_trunc`
 * kiểu Postgres (tuần bắt đầu Thứ Hai).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export const MIN_WEEKS = 1;
export const MAX_WEEKS = 52;
export const DEFAULT_WEEKS = 12;

/** Cửa sổ thời gian áp cho mọi chỉ số theo kỳ. `to` = thời điểm hiện tại. */
export interface KpiWindow {
  from: Date;
  to: Date;
  weeks: number;
}

/** Kẹp `weeks` về [MIN_WEEKS, MAX_WEEKS]; giá trị không hợp lệ ⇒ DEFAULT_WEEKS. */
export function clampWeeks(weeks: number): number {
  if (!Number.isFinite(weeks)) return DEFAULT_WEEKS;
  const w = Math.floor(weeks);
  if (w < MIN_WEEKS) return MIN_WEEKS;
  if (w > MAX_WEEKS) return MAX_WEEKS;
  return w;
}

/** 00:00:00.000 UTC của Thứ Hai thuộc tuần chứa `date`. */
export function startOfUtcWeekMonday(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dow = d.getUTCDay(); // 0=CN..6=T7
  const daysSinceMonday = (dow + 6) % 7; // T2→0, CN→6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d;
}

/**
 * Dựng cửa sổ `weeks` tuần gần nhất: gồm `weeks` mốc tuần (Thứ Hai, UTC), tuần
 * cuối là tuần hiện tại (một phần). `from` = đầu tuần hiện tại lùi (weeks−1) tuần.
 */
export function resolveWindow(weeks: number, now: Date): KpiWindow {
  const w = clampWeeks(weeks);
  const currentWeekStart = startOfUtcWeekMonday(now);
  const from = new Date(currentWeekStart.getTime() - (w - 1) * WEEK_MS);
  return { from, to: new Date(now.getTime()), weeks: w };
}

/** Phân số an toàn: mẫu ≤ 0 ⇒ null (UI hiển thị "—"). */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

/** Ép số (null/undefined/không hợp lệ ⇒ 0). */
function num(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Parse ISO → Date hợp lệ, hoặc null. */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `date` nằm trong [from, to] (bao cả hai đầu mút). */
function inWindow(date: Date, window: KpiWindow): boolean {
  const t = date.getTime();
  return t >= window.from.getTime() && t <= window.to.getTime();
}

/** Chỉ số tuần (0-based) của `date` so với `from`; <0 nếu trước cửa sổ. */
function weekIndexOf(date: Date, window: KpiWindow): number {
  return Math.floor((date.getTime() - window.from.getTime()) / WEEK_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) Lead / tuần + nguồn + funnel lead→thử→chính thức
// ─────────────────────────────────────────────────────────────────────────────

export type LeadSource = Lead['source'];
export type LeadStatus = Lead['status'];

/** Hàng lead tối thiểu cần để tính KPI. */
export interface LeadRow {
  createdAt: string;
  source: LeadSource;
  status: LeadStatus;
}

export interface LeadWeeklyBucket {
  weekStart: Date;
  count: number;
}

export interface LeadSourceCount {
  source: LeadSource;
  count: number;
  /** Tỉ trọng trên tổng lead trong cửa sổ (null nếu tổng = 0). */
  pct: number | null;
}

export interface LeadFunnel {
  total: number;
  /** status ∈ {da_lien_he, dang_ky_hoc_thu, da_chot} */
  contacted: number;
  /** Đã (ít nhất) học thử: status ∈ {dang_ky_hoc_thu, da_chot} */
  trial: number;
  /** Đã chốt (chính thức): status = da_chot */
  official: number;
  /** Không phù hợp: status = khong_phu_hop */
  unfit: number;
  rateLeadToTrial: number | null;
  rateTrialToOfficial: number | null;
  rateLeadToOfficial: number | null;
}

export interface LeadKpis {
  weekly: LeadWeeklyBucket[];
  bySource: LeadSourceCount[];
  funnel: LeadFunnel;
}

/** Thứ tự nguồn cố định để bảng ổn định (kể cả nguồn có 0 lead). */
export const LEAD_SOURCES: readonly LeadSource[] = [
  'google',
  'facebook',
  'gioi_thieu',
  'khac',
];

const CONTACTED_STATUSES: readonly LeadStatus[] = [
  'da_lien_he',
  'dang_ky_hoc_thu',
  'da_chot',
];
const TRIAL_STATUSES: readonly LeadStatus[] = ['dang_ky_hoc_thu', 'da_chot'];

/**
 * Tính: lead theo tuần, theo nguồn, và funnel lead→thử→chính thức — tất cả trên
 * tập lead có `createdAt` ∈ cửa sổ. Funnel diễn giải theo TRẠNG THÁI HIỆN TẠI:
 * "đã chốt" hàm ý đã qua "học thử"; "học thử" hàm ý đã "liên hệ".
 */
export function computeLeadKpis(rows: LeadRow[], window: KpiWindow): LeadKpis {
  const inRange = rows
    .map((r) => ({ ...r, date: parseDate(r.createdAt) }))
    .filter((r): r is LeadRow & { date: Date } => r.date !== null && inWindow(r.date, window));

  // Weekly buckets — `weeks` mốc tuần liên tiếp.
  const weekly: LeadWeeklyBucket[] = Array.from({ length: window.weeks }, (_, i) => ({
    weekStart: new Date(window.from.getTime() + i * WEEK_MS),
    count: 0,
  }));
  for (const r of inRange) {
    const idx = weekIndexOf(r.date, window);
    if (idx >= 0 && idx < window.weeks) weekly[idx].count += 1;
  }

  const total = inRange.length;

  // Theo nguồn (giữ đủ 4 nguồn, kể cả 0).
  const bySource: LeadSourceCount[] = LEAD_SOURCES.map((source) => {
    const count = inRange.filter((r) => r.source === source).length;
    return { source, count, pct: ratio(count, total) };
  });

  // Funnel.
  const contacted = inRange.filter((r) => CONTACTED_STATUSES.includes(r.status)).length;
  const trial = inRange.filter((r) => TRIAL_STATUSES.includes(r.status)).length;
  const official = inRange.filter((r) => r.status === 'da_chot').length;
  const unfit = inRange.filter((r) => r.status === 'khong_phu_hop').length;

  const funnel: LeadFunnel = {
    total,
    contacted,
    trial,
    official,
    unfit,
    rateLeadToTrial: ratio(trial, total),
    rateTrialToOfficial: ratio(official, trial),
    rateLeadToOfficial: ratio(official, total),
  };

  return { weekly, bySource, funnel };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) Tái tục — HV có ≥2 chu kỳ / HV có ≥1 chu kỳ (toàn thời gian)
// ─────────────────────────────────────────────────────────────────────────────

export interface RenewalKpis {
  /** Số học viên có ≥1 chu kỳ học phí. */
  withCycle: number;
  /** Số học viên có ≥2 chu kỳ (đã tái tục ít nhất 1 lần). */
  renewed: number;
  rate: number | null;
}

/**
 * Nhận MẢNG id học viên (mỗi chu kỳ học phí một phần tử — có lặp). Đếm số chu kỳ
 * theo từng học viên rồi suy ra tỉ lệ tái tục.
 */
export function computeRenewalRate(studentIds: number[]): RenewalKpis {
  const countByStudent = new Map<number, number>();
  for (const id of studentIds) {
    countByStudent.set(id, (countByStudent.get(id) ?? 0) + 1);
  }
  const withCycle = countByStudent.size;
  let renewed = 0;
  for (const c of countByStudent.values()) if (c >= 2) renewed += 1;
  return { withCycle, renewed, rate: ratio(renewed, withCycle) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) Điểm danh TB — Có mặt / (Có mặt + Vắng + Phép)
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceCounts {
  present: number; // co_mat
  absent: number; // vang
  excused: number; // phep
}

export interface AttendanceKpis extends AttendanceCounts {
  total: number;
  presentRate: number | null;
}

export function computeAttendanceRate(counts: AttendanceCounts): AttendanceKpis {
  const present = num(counts.present);
  const absent = num(counts.absent);
  const excused = num(counts.excused);
  const total = present + absent + excused;
  return { present, absent, excused, total, presentRate: ratio(present, total) };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) Doanh thu — Σ(hocPhi + tienSach), Payments đã nộp, trong cửa sổ theo ngayNop
// ─────────────────────────────────────────────────────────────────────────────

/** Hàng thanh toán tối thiểu (đã lọc tinhTrang=da_nop ở lớp truy vấn). */
export interface PaymentRow {
  ngayNop: string;
  hocPhi?: number | null;
  tienSach?: number | null;
  muaKhac?: number | null;
}

export interface RevenueWeeklyBucket {
  weekStart: Date;
  amount: number;
}

export interface RevenueKpis {
  /** Doanh thu = hocPhi + tienSach (KHÔNG gồm muaKhac). */
  total: number;
  hocPhi: number;
  tienSach: number;
  /** Hiển thị tham khảo, KHÔNG cộng vào total. */
  muaKhac: number;
  weekly: RevenueWeeklyBucket[];
}

export function computeRevenue(rows: PaymentRow[], window: KpiWindow): RevenueKpis {
  const inRange = rows
    .map((r) => ({ ...r, date: parseDate(r.ngayNop) }))
    .filter((r): r is PaymentRow & { date: Date } => r.date !== null && inWindow(r.date, window));

  const weekly: RevenueWeeklyBucket[] = Array.from({ length: window.weeks }, (_, i) => ({
    weekStart: new Date(window.from.getTime() + i * WEEK_MS),
    amount: 0,
  }));

  let hocPhi = 0;
  let tienSach = 0;
  let muaKhac = 0;
  for (const r of inRange) {
    const hp = num(r.hocPhi);
    const ts = num(r.tienSach);
    hocPhi += hp;
    tienSach += ts;
    muaKhac += num(r.muaKhac);
    const idx = weekIndexOf(r.date, window);
    if (idx >= 0 && idx < window.weeks) weekly[idx].amount += hp + ts;
  }

  return { total: hocPhi + tienSach, hocPhi, tienSach, muaKhac, weekly };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) Chi phí — Σ(amount) Expenses, trong cửa sổ theo spentAt
// ─────────────────────────────────────────────────────────────────────────────

/** Hàng phiếu chi tối thiểu cần để tính KPI. */
export interface ExpenseRow {
  spentAt: string;
  amount?: number | null;
}

export interface ExpenseWeeklyBucket {
  weekStart: Date;
  amount: number;
}

export interface ExpenseKpis {
  /** Tổng chi = Σ(amount) trong cửa sổ. */
  total: number;
  weekly: ExpenseWeeklyBucket[];
}

export function computeExpenses(rows: ExpenseRow[], window: KpiWindow): ExpenseKpis {
  const inRange = rows
    .map((r) => ({ ...r, date: parseDate(r.spentAt) }))
    .filter((r): r is ExpenseRow & { date: Date } => r.date !== null && inWindow(r.date, window));

  const weekly: ExpenseWeeklyBucket[] = Array.from({ length: window.weeks }, (_, i) => ({
    weekStart: new Date(window.from.getTime() + i * WEEK_MS),
    amount: 0,
  }));

  let total = 0;
  for (const r of inRange) {
    const amt = num(r.amount);
    total += amt;
    const idx = weekIndexOf(r.date, window);
    if (idx >= 0 && idx < window.weeks) weekly[idx].amount += amt;
  }

  return { total, weekly };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5b) Hoàn tiền — Σ(soTien) Refunds, trong cửa sổ theo ngayHoan (vế tiền ra)
// ─────────────────────────────────────────────────────────────────────────────

export interface RefundRow {
  ngayHoan: string;
  soTien?: number | null;
}

export interface RefundKpis {
  total: number;
  weekly: { weekStart: Date; amount: number }[];
}

export function computeRefunds(rows: RefundRow[], window: KpiWindow): RefundKpis {
  const inRange = rows
    .map((r) => ({ ...r, date: parseDate(r.ngayHoan) }))
    .filter((r): r is RefundRow & { date: Date } => r.date !== null && inWindow(r.date, window));

  const weekly = Array.from({ length: window.weeks }, (_, i) => ({
    weekStart: new Date(window.from.getTime() + i * WEEK_MS),
    amount: 0,
  }));

  let total = 0;
  for (const r of inRange) {
    const amt = num(r.soTien);
    total += amt;
    const idx = weekIndexOf(r.date, window);
    if (idx >= 0 && idx < window.weeks) weekly[idx].amount += amt;
  }
  return { total, weekly };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) Dòng tiền — Thu (doanh thu) − Hoàn − Chi, tổng + theo tuần
// ─────────────────────────────────────────────────────────────────────────────

export interface CashflowWeeklyBucket {
  weekStart: Date;
  revenue: number;
  expense: number;
  net: number;
}

export interface CashflowKpis {
  revenue: number;
  /** Tổng hoàn tiền (tiền ra) trong cửa sổ. */
  refunds: number;
  expense: number;
  /** net = revenue − refunds − expense (có thể âm). */
  net: number;
  weekly: CashflowWeeklyBucket[];
}

/**
 * Ghép Thu (RevenueKpis) và Chi (ExpenseKpis) — CÙNG cửa sổ ⇒ mảng weekly cùng độ
 * dài, ghép theo chỉ số tuần. Doanh thu = hocPhi + tienSach (xem computeRevenue);
 * chi = Σ amount Expenses. net = Thu − Chi.
 */
export function computeCashflow(
  revenue: RevenueKpis,
  expenses: ExpenseKpis,
  refunds: RefundKpis = { total: 0, weekly: [] },
): CashflowKpis {
  const weekly: CashflowWeeklyBucket[] = revenue.weekly.map((r, i) => {
    const expense = expenses.weekly[i]?.amount ?? 0;
    const refund = refunds.weekly[i]?.amount ?? 0;
    return { weekStart: r.weekStart, revenue: r.amount, expense, net: r.amount - refund - expense };
  });
  return {
    revenue: revenue.total,
    refunds: refunds.total,
    expense: expenses.total,
    net: revenue.total - refunds.total - expenses.total,
    weekly,
  };
}

/** Gói toàn bộ KPI để view render trong một lần. */
export interface KpiReport {
  window: KpiWindow;
  leads: LeadKpis;
  renewal: RenewalKpis;
  attendance: AttendanceKpis;
  revenue: RevenueKpis;
  refunds: RefundKpis;
  expenses: ExpenseKpis;
  cashflow: CashflowKpis;
}
