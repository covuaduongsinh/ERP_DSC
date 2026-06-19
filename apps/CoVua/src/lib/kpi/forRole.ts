import 'server-only';
import type { Payload, Where } from 'payload';
import type { User } from '@/payload-types';
import type { UserRole } from '@/access/roles';
import type { StaffQueueCounts } from '@/lib/staff-queues';
import { getKpiReport } from './report';
import { DEFAULT_WEEKS } from './compute';
import { formatPercent, formatVnd } from './format';

/**
 * KPI theo vai trò cho Bảng điều khiển /admin.
 *
 * NGUYÊN TẮC:
 *  - Mọi truy vấn `overrideAccess:false` + `user` (access từng collection là sự thật).
 *  - CHỈ admin/manager mới gọi `getKpiReport` (đọc xuyên leads/payments/expenses
 *    nên KHÔNG throw). Vai trò khác KHÔNG đọc được leads/payments ⇒ dùng count
 *    có `disableErrors:true` (trả 0 thay vì Forbidden) + hàng đợi đã đếm sẵn.
 *  - KHÔNG bịa delta tháng-trước: hiển thị giá trị thật + nhãn phụ mô tả.
 */

export interface RoleKpi {
  label: string;
  value: string;
  sub: string;
}

/** 'all' ⇒ không lọc (access tự scope); number[] ⇒ lọc IN các cơ sở đang chọn. */
function branchWhere(active: 'all' | number[]): Where | undefined {
  return active !== 'all' && active.length > 0 ? { location: { in: active } } : undefined;
}

export async function getRoleKpis(args: {
  payload: Payload;
  user: User;
  role: UserRole;
  queue: StaffQueueCounts;
  branchActive: 'all' | number[];
}): Promise<RoleKpi[]> {
  const { payload, user, role, queue, branchActive } = args;
  const common = { user, overrideAccess: false, disableErrors: true } as const;
  const where = branchWhere(branchActive);

  const countStudents = async () =>
    (await payload.count({ collection: 'students', ...(where ? { where } : {}), ...common })).totalDocs;
  const countClasses = async () =>
    (await payload.count({ collection: 'classes', ...(where ? { where } : {}), ...common })).totalDocs;
  const countLeadsByStatus = async (status: string) =>
    (await payload.count({ collection: 'leads', where: { status: { equals: status } }, ...common })).totalDocs;

  const totalWork =
    queue.uncaredLeads +
    queue.overdueFollowUpLeads +
    queue.pendingRenewalRequests +
    queue.lowSessionStudents +
    queue.reconcileStudents +
    queue.draftProgressReports;

  // Admin/manager: đọc đầy đủ ⇒ KPI giàu (cửa sổ doanh thu + phễu chuyển đổi).
  if (role === 'admin' || role === 'manager') {
    const [report, students] = await Promise.all([
      getKpiReport({ payload, user, weeks: DEFAULT_WEEKS }),
      countStudents(),
    ]);
    const w = report.window.weeks;
    return [
      { label: 'Học viên đang học', value: String(students), sub: 'tổng học viên' },
      { label: `Lead (${w} tuần)`, value: String(report.leads.funnel.total), sub: 'lead mới trong cửa sổ' },
      { label: 'Tỷ lệ chuyển đổi', value: formatPercent(report.leads.funnel.rateLeadToOfficial), sub: 'lead → chính thức' },
      {
        label: `Doanh thu thuần (${w} tuần)`,
        value: formatVnd(report.revenue.total - report.refunds.total),
        sub: report.refunds.total > 0 ? `Thu − hoàn ${formatVnd(report.refunds.total)}` : 'đã thu',
      },
    ];
  }

  if (role === 'accountant') {
    const pendingPay = (
      await payload.count({ collection: 'payments', where: { tinhTrang: { equals: 'cho' } }, ...common })
    ).totalDocs;
    return [
      { label: 'Phiếu thu chờ', value: String(pendingPay), sub: 'chưa xác nhận' },
      { label: 'Gia hạn chờ duyệt', value: String(queue.pendingRenewalRequests), sub: 'từ phụ huynh' },
      { label: 'Sắp hết buổi', value: String(queue.lowSessionStudents), sub: 'cần nhắc gia hạn' },
      { label: 'Cần đối soát buổi', value: String(queue.reconcileStudents), sub: 'tồn âm / thiếu phiếu' },
    ];
  }

  if (role === 'receptionist') {
    const [students, trial] = await Promise.all([countStudents(), countLeadsByStatus('dang_ky_hoc_thu')]);
    return [
      { label: 'Lead chưa chăm', value: String(queue.uncaredLeads), sub: 'mới gửi' },
      { label: 'Follow-up quá hạn', value: String(queue.overdueFollowUpLeads), sub: 'trễ hẹn liên hệ' },
      { label: 'Đang học thử', value: String(trial), sub: 'đã đặt lịch' },
      { label: 'Học viên đang học', value: String(students), sub: 'tổng học viên' },
    ];
  }

  // coach / assistant: phạm vi cơ sở — lớp/học viên + việc cần làm.
  const [classes, students] = await Promise.all([countClasses(), countStudents()]);
  return [
    { label: 'Lớp tại cơ sở', value: String(classes), sub: 'đang mở' },
    { label: 'Học viên tại cơ sở', value: String(students), sub: 'cùng cơ sở' },
    { label: 'Báo cáo cần soạn', value: String(queue.draftProgressReports), sub: 'chưa phát hành' },
    { label: 'Việc cần xử lý', value: String(totalWork), sub: 'đang chờ' },
  ];
}
