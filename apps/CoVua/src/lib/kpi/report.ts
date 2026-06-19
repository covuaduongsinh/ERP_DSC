import 'server-only';
import type { Payload, PayloadRequest } from 'payload';
import {
  computeAttendanceRate,
  computeCashflow,
  computeExpenses,
  computeLeadKpis,
  computeRefunds,
  computeRenewalRate,
  computeRevenue,
  resolveWindow,
  type ExpenseRow,
  type KpiReport,
  type LeadRow,
  type PaymentRow,
  type RefundRow,
} from './compute';

/**
 * Lớp NẠP DỮ LIỆU (server-only) cho trang Báo cáo KPI.
 *
 * NGUYÊN TẮC BẢO MẬT (bám `lib/staff-queues.ts`): mọi truy vấn qua Local API với
 * `overrideAccess: false` + `user` đang đăng nhập ⇒ access control của từng
 * collection là nguồn sự thật. Trang chỉ mở cho manager/admin (canViewReports) —
 * cả hai là GLOBAL_BRANCH_ROLES nên đọc TOÀN BỘ (không bị lọc theo cơ sở), và
 * Leads cho phép admin/manager đọc ⇒ số liệu đầy đủ, không leak.
 *
 * Lớp này chỉ nạp + gọi hàm thuần ở `./compute.ts`; KHÔNG chứa logic định nghĩa
 * chỉ số (đã ở compute để unit-test).
 */

type ReportUser = PayloadRequest['user'];

const WEEK_DAY_RANGE = (fromISO: string, toISO: string) => ({
  greater_than_equal: fromISO,
  less_than_equal: toISO,
});

export interface GetKpiReportArgs {
  payload: Payload;
  user: ReportUser;
  weeks: number;
  /** Tiêm để test/tất định; mặc định now. */
  now?: Date;
}

export async function getKpiReport({
  payload,
  user,
  weeks,
  now = new Date(),
}: GetKpiReportArgs): Promise<KpiReport> {
  const window = resolveWindow(weeks, now);
  const fromISO = window.from.toISOString();
  const toISO = window.to.toISOString();

  const common = { user: user ?? undefined, overrideAccess: false } as const;

  const [leadsRes, cyclesRes, present, absent, excused, paymentsRes, expensesRes, refundsRes] = await Promise.all([
    // Leads trong cửa sổ theo createdAt.
    payload.find({
      collection: 'leads',
      where: { createdAt: WEEK_DAY_RANGE(fromISO, toISO) },
      depth: 0,
      pagination: false,
      select: { createdAt: true, source: true, status: true },
      ...common,
    }),
    // Chu kỳ học phí — toàn thời gian, chỉ cần id học viên.
    payload.find({
      collection: 'tuition-cycles',
      depth: 0,
      pagination: false,
      select: { student: true },
      ...common,
    }),
    // Điểm danh: đếm theo trạng thái trong cửa sổ (không nạp dòng — bảng lớn).
    payload.count({
      collection: 'attendance',
      where: { status: { equals: 'co_mat' }, date: WEEK_DAY_RANGE(fromISO, toISO) },
      ...common,
    }),
    payload.count({
      collection: 'attendance',
      where: { status: { equals: 'vang' }, date: WEEK_DAY_RANGE(fromISO, toISO) },
      ...common,
    }),
    payload.count({
      collection: 'attendance',
      where: { status: { equals: 'phep' }, date: WEEK_DAY_RANGE(fromISO, toISO) },
      ...common,
    }),
    // Thanh toán đã nộp trong cửa sổ theo ngayNop.
    payload.find({
      collection: 'payments',
      where: {
        tinhTrang: { equals: 'da_nop' },
        ngayNop: WEEK_DAY_RANGE(fromISO, toISO),
      },
      depth: 0,
      pagination: false,
      select: { ngayNop: true, hocPhi: true, tienSach: true, muaKhac: true },
      ...common,
    }),
    // Chi phí trong cửa sổ theo spentAt (chỉ manager/admin/accountant đọc được;
    // trang KPI gated manager/admin = global roles ⇒ đọc đủ).
    payload.find({
      collection: 'expenses',
      where: { spentAt: WEEK_DAY_RANGE(fromISO, toISO) },
      depth: 0,
      pagination: false,
      select: { spentAt: true, amount: true },
      ...common,
    }),
    // Hoàn tiền trong cửa sổ theo ngayHoan (cùng gate tài chính như expenses).
    payload.find({
      collection: 'refunds',
      where: { ngayHoan: WEEK_DAY_RANGE(fromISO, toISO) },
      depth: 0,
      pagination: false,
      select: { ngayHoan: true, soTien: true },
      ...common,
    }),
  ]);

  const leadRows: LeadRow[] = leadsRes.docs.map((d) => ({
    createdAt: d.createdAt,
    source: d.source,
    status: d.status,
  }));

  const studentIds: number[] = cyclesRes.docs
    .map((d) => (typeof d.student === 'number' ? d.student : d.student?.id))
    .filter((id): id is number => typeof id === 'number');

  const paymentRows: PaymentRow[] = paymentsRes.docs.map((d) => ({
    ngayNop: d.ngayNop,
    hocPhi: d.hocPhi,
    tienSach: d.tienSach,
    muaKhac: d.muaKhac,
  }));

  const expenseRows: ExpenseRow[] = expensesRes.docs.map((d) => ({
    spentAt: d.spentAt,
    amount: d.amount,
  }));

  const refundRows: RefundRow[] = refundsRes.docs.map((d) => ({
    ngayHoan: d.ngayHoan,
    soTien: d.soTien,
  }));

  const revenue = computeRevenue(paymentRows, window);
  const expenses = computeExpenses(expenseRows, window);
  const refunds = computeRefunds(refundRows, window);

  return {
    window,
    leads: computeLeadKpis(leadRows, window),
    renewal: computeRenewalRate(studentIds),
    attendance: computeAttendanceRate({
      present: present.totalDocs,
      absent: absent.totalDocs,
      excused: excused.totalDocs,
    }),
    revenue,
    refunds,
    expenses,
    cashflow: computeCashflow(revenue, expenses, refunds),
  };
}
