import 'server-only';
import { headers as nextHeaders } from 'next/headers';
import type { Payload } from 'payload';
import type { Lead, RenewalRequest, User } from '@/payload-types';
import { getPayloadClient } from './payload';
import { loadSessionBalances } from './operations/session-balance';

/**
 * Đếm 4 hàng đợi "việc cần làm" cho bảng điều khiển nhân viên.
 *
 * NGUYÊN TẮC BẢO MẬT (đường dữ liệu khách hàng + cổng phụ huynh):
 *  - Mọi truy vấn qua Payload Local API với `overrideAccess: false` + `user` là
 *    người đang đăng nhập ⇒ access control của TỪNG collection là nguồn sự thật
 *    duy nhất cho "role nào thấy được hàng đợi nào". KHÔNG lặp lại logic phân
 *    quyền ở đây. Ví dụ: chỉ admin/manager/lễ tân đọc được Leads (xem
 *    collections/Leads.ts) ⇒ coach/kế toán nhận `uncaredLeads = 0`.
 *  - `disableErrors: true`: khi role không có quyền đọc, Payload trả về 0 thay
 *    vì ném `Forbidden` (xem find/count operation: access=false ⇒ docs rỗng /
 *    totalDocs=0). Nhờ vậy đếm "theo role" mà không cần try/catch.
 *  - Chỉ trả SỐ LIỆU (kiểu `StaffQueueCounts`); KHÔNG dựng UI.
 *
 * Xem [[feedback_payload_overrideaccess]] và [[project_access_hasrole]].
 */

/** Số liệu 4 hàng đợi để UI render badge/thẻ — không kèm bất kỳ markup nào. */
export interface StaffQueueCounts {
  /**
   * Lead "chưa chăm": trạng thái `moi` (mới gửi, chưa ai liên hệ). Chỉ
   * admin/manager/lễ tân đọc được Leads ⇒ role khác luôn nhận 0.
   */
  uncaredLeads: number;
  /** Báo cáo tiến độ còn nháp: `publishedAt = null` (phụ huynh chưa thấy). */
  draftProgressReports: number;
  /** Yêu cầu gia hạn đang chờ: trạng thái `moi` hoặc `dang_xu_ly`. */
  pendingRenewalRequests: number;
  /** Học viên sắp hết số buổi tồn (0 ≤ tồn ≤ ngưỡng) — cần nhắc gia hạn. */
  lowSessionStudents: number;
  /** Học viên cần đối soát số buổi tồn (tồn âm hoặc chưa có phiếu thu). */
  reconcileStudents: number;
  /**
   * Lead ĐANG chăm sóc nhưng QUÁ HẠN follow-up (`nextFollowUpAt` < hiện tại) —
   * SLA chăm sóc lead. Chỉ admin/manager/lễ tân đọc Leads ⇒ role khác nhận 0.
   */
  overdueFollowUpLeads: number;
}

/** Mặc định khi không có nhân viên đăng nhập (cũng dùng làm giá trị an toàn). */
export const EMPTY_STAFF_QUEUE_COUNTS: StaffQueueCounts = {
  uncaredLeads: 0,
  draftProgressReports: 0,
  pendingRenewalRequests: 0,
  lowSessionStudents: 0,
  reconcileStudents: 0,
  overdueFollowUpLeads: 0,
};

/** Trạng thái Lead coi là "chưa chăm" (chưa nhân viên nào xử lý). */
export const UNCARED_LEAD_STATUSES: Lead['status'][] = ['moi'];

/**
 * Trạng thái Lead ĐANG trong pipeline chăm sóc (đã liên hệ / đã đăng ký học thử)
 * — có thể bị quá hạn follow-up. `moi` chưa ai nhận (đã đếm ở uncaredLeads);
 * `da_chot`/`khong_phu_hop` là điểm cuối, không còn theo dõi.
 */
export const FOLLOW_UP_LEAD_STATUSES: Lead['status'][] = [
  'da_lien_he',
  'dang_ky_hoc_thu',
];

/** Trạng thái RenewalRequest coi là "đang chờ" nhân viên xử lý. */
export const PENDING_RENEWAL_STATUSES: RenewalRequest['status'][] = [
  'moi',
  'dang_xu_ly',
];

/**
 * Nhân viên (collection `users`) đang đăng nhập, hoặc null. Phụ huynh
 * (collection `parents`) KHÔNG phải staff ⇒ null: các hàng đợi này là việc nội
 * bộ nhân viên, không hiển thị cho cổng phụ huynh.
 */
export async function getCurrentStaffUser(payload: Payload): Promise<User | null> {
  const headersList = await nextHeaders();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });
  return user?.collection === 'users' ? (user as User) : null;
}

/** Lead chưa chăm (trạng thái `moi`). */
export async function countUncaredLeads(
  payload: Payload,
  user: User | null,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'leads',
    where: { status: { in: UNCARED_LEAD_STATUSES } },
    user: user ?? undefined,
    overrideAccess: false,
    disableErrors: true,
  });
  return totalDocs;
}

/**
 * Mốc lọc báo cáo nháp cho hàng đợi nhân viên.
 *
 * Toàn bộ báo cáo tiến độ hiện có (194 bản, cả 3 kỳ) là MỘT đợt import lịch sử
 * (`createdAt` 2026-05-29 → 2026-06-01) và đều chưa phát hành — KHÔNG phải "việc
 * mới cần làm" nên không được nhắc hằng ngày trên dashboard. Hàng đợi chỉ đếm
 * bản nháp TẠO TỪ mốc này trở đi (nhân viên soạn mới qua /admin) ⇒ phản ánh đúng
 * tồn việc thật. Tồn lịch sử (nếu muốn phát hành hồi tố) xử lý riêng, không qua
 * hàng đợi này. Lọc theo `createdAt` (không theo `period`) vì cả 3 kỳ đều là dữ
 * liệu lịch sử — lọc theo kỳ sẽ chặn nhầm báo cáo tương lai dùng lại tên kỳ đó.
 */
export const DRAFT_QUEUE_SINCE = '2026-06-02T00:00:00.000Z';

/** Báo cáo nháp (`publishedAt = null`) tạo TỪ `DRAFT_QUEUE_SINCE` trở đi. */
export async function countDraftProgressReports(
  payload: Payload,
  user: User | null,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'progress-reports',
    where: {
      and: [
        { publishedAt: { equals: null } },
        { createdAt: { greater_than_equal: DRAFT_QUEUE_SINCE } },
      ],
    },
    user: user ?? undefined,
    overrideAccess: false,
    disableErrors: true,
  });
  return totalDocs;
}

/** Yêu cầu gia hạn đang chờ xử lý (`moi` | `dang_xu_ly`). */
export async function countPendingRenewalRequests(
  payload: Payload,
  user: User | null,
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'renewal-requests',
    where: { status: { in: PENDING_RENEWAL_STATUSES } },
    user: user ?? undefined,
    overrideAccess: false,
    disableErrors: true,
  });
  return totalDocs;
}

/**
 * Hàng đợi SỐ BUỔI TỒN cấp HỌC VIÊN (thay cho đếm theo TuitionCycles — vốn rỗng
 * ở prod). Tính từ Payments + Attendance qua `loadSessionBalances`:
 *  - `low`       : 0 ≤ tồn ≤ ngưỡng ⇒ cần nhắc gia hạn.
 *  - `reconcile` : tồn âm (đã học vượt) hoặc chưa có phiếu thu ⇒ cần đối soát.
 *
 * Một lượt `loadSessionBalances` trả cả hai count (tránh quét 2 lần). Không có
 * nhân viên đăng nhập ⇒ {0,0} (hàng đợi nội bộ, không cho cổng phụ huynh).
 */
export async function countSessionBalanceQueues(
  payload: Payload,
  user: User | null,
): Promise<{ low: number; reconcile: number }> {
  if (!user) return { low: 0, reconcile: 0 };
  const rows = await loadSessionBalances(payload, user);
  let low = 0;
  let reconcile = 0;
  for (const r of rows) {
    if (r.flag === 'low') low += 1;
    else if (r.flag === 'negative' || r.flag === 'none') reconcile += 1;
  }
  return { low, reconcile };
}

/**
 * Lead đang chăm sóc nhưng QUÁ HẠN follow-up (`nextFollowUpAt` < hiện tại).
 * `less_than` cũng loại bản ghi `nextFollowUpAt = null` (không hẹn lịch) ⇒ chỉ
 * đếm lead đã hẹn mà trễ hẹn. SLA chăm sóc lead.
 */
export async function countOverdueFollowUpLeads(
  payload: Payload,
  user: User | null,
  now: Date = new Date(),
): Promise<number> {
  const { totalDocs } = await payload.count({
    collection: 'leads',
    where: {
      and: [
        { status: { in: FOLLOW_UP_LEAD_STATUSES } },
        { nextFollowUpAt: { less_than: now.toISOString() } },
      ],
    },
    user: user ?? undefined,
    overrideAccess: false,
    disableErrors: true,
  });
  return totalDocs;
}

/**
 * Đếm cả 5 hàng đợi cho nhân viên đang đăng nhập (resolve user 1 lần, chạy song
 * song). Không có nhân viên đăng nhập ⇒ tất cả 0.
 *
 * Hàm để UI (Server Component) gọi và nhận `StaffQueueCounts`.
 */
export async function getStaffQueueCounts(): Promise<StaffQueueCounts> {
  const payload = await getPayloadClient();
  const user = await getCurrentStaffUser(payload);
  if (!user) return { ...EMPTY_STAFF_QUEUE_COUNTS };

  const [
    uncaredLeads,
    draftProgressReports,
    pendingRenewalRequests,
    sessionQueues,
    overdueFollowUpLeads,
  ] = await Promise.all([
    countUncaredLeads(payload, user),
    countDraftProgressReports(payload, user),
    countPendingRenewalRequests(payload, user),
    countSessionBalanceQueues(payload, user),
    countOverdueFollowUpLeads(payload, user),
  ]);

  return {
    uncaredLeads,
    draftProgressReports,
    pendingRenewalRequests,
    lowSessionStudents: sessionQueues.low,
    reconcileStudents: sessionQueues.reconcile,
    overdueFollowUpLeads,
  };
}
