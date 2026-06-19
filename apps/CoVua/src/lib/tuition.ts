import type { TuitionCycle } from '@/payload-types';

/**
 * Phép tính thuần về chu kỳ học phí (KHÔNG I/O, KHÔNG `server-only`) — dùng được
 * cả ở Server Component lẫn unit-test. `sessionsUsed` là virtual field (đếm
 * Attendance lúc đọc), nên các hàm dưới đây chỉ làm số học trên dữ liệu ĐÃ đọc.
 */

export function sessionsRemaining(cycle: TuitionCycle): number {
  // sessionsUsed là virtual field (TÍNH từ Attendance) nên có thể optional.
  return Math.max(0, cycle.sessionsTotal - (cycle.sessionsUsed ?? 0));
}

/** Ngưỡng cảnh báo sắp hết gói (buổi còn lại). */
export const TUITION_LOW_THRESHOLD = 3;

export function isTuitionLow(cycle: TuitionCycle): boolean {
  return (
    cycle.status === 'sap_het' || sessionsRemaining(cycle) <= TUITION_LOW_THRESHOLD
  );
}

export function getTuitionWarningMessage(cycle: TuitionCycle): string {
  const remaining = sessionsRemaining(cycle);
  return `Còn ${remaining} buổi, liên hệ gia hạn`;
}

/** Chu kỳ hết hạn trong ≤ N ngày tới (kể cả đã quá hạn) coi là "sắp hết hạn". */
export const TUITION_EXPIRING_SOON_DAYS = 7;

/**
 * Vị từ "sắp hết BUỔI hoặc sắp hết HẠN" — thuần (tách `now` ra để unit-test).
 *
 *  - Sắp hết BUỔI: dùng đúng quy ước cổng phụ huynh (`isTuitionLow`) — status
 *    `sap_het` hoặc số buổi còn lại ≤ `TUITION_LOW_THRESHOLD`.
 *  - Sắp hết HẠN: có `expectedEndDate` và rơi vào trong `TUITION_EXPIRING_SOON_DAYS`
 *    ngày tới (kể cả đã quá hạn). Gói đã đánh dấu `da_het` thì bỏ qua nhánh hạn.
 */
export function isTuitionCycleLowOrExpiring(
  cycle: TuitionCycle,
  now: Date = new Date(),
): boolean {
  const lowSessions = isTuitionLow(cycle);

  let expiringSoon = false;
  if (cycle.status !== 'da_het' && cycle.expectedEndDate) {
    const end = new Date(cycle.expectedEndDate);
    if (!Number.isNaN(end.getTime())) {
      const horizon = new Date(now);
      horizon.setDate(horizon.getDate() + TUITION_EXPIRING_SOON_DAYS);
      expiringSoon = end <= horizon;
    }
  }

  return lowSessions || expiringSoon;
}

/** Trạng thái gói (khớp enum TuitionCycle.status). */
export type TuitionCycleStatus = 'dang_hoc' | 'sap_het' | 'da_het';

/**
 * Suy ra trạng thái gói TỪ DỮ LIỆU (không phụ thuộc status cũ ⇒ tất định, idempotent)
 * — dùng cho job reconcile chạy định kỳ tự cập nhật `tuition-cycles.status`.
 *
 * Quy tắc (BẢO THỦ — không bao giờ ẩn gói còn buổi):
 *  - `da_het`  : đã dùng hết buổi (sessionsRemaining ≤ 0). CHỈ điều kiện này, KHÔNG
 *    dựa quá hạn — gói quá ngày nhưng còn buổi vẫn cần nhắc gia hạn, không "hết".
 *  - `sap_het` : còn buổi nhưng sắp hết buổi (≤ ngưỡng) HOẶC sắp/đã quá hạn (≤ N ngày).
 *  - `dang_hoc`: còn lại.
 *
 * `now` tiêm vào để unit-test. `sessionsUsed` là virtual (đã đọc) ⇒ chỉ số học.
 */
export function resolveTuitionCycleStatus(
  cycle: TuitionCycle,
  now: Date = new Date(),
): TuitionCycleStatus {
  const remaining = sessionsRemaining(cycle);
  if (remaining <= 0) return 'da_het';

  const lowSessions = remaining <= TUITION_LOW_THRESHOLD;

  let expiringSoon = false;
  if (cycle.expectedEndDate) {
    const end = new Date(cycle.expectedEndDate);
    if (!Number.isNaN(end.getTime())) {
      const horizon = new Date(now);
      horizon.setDate(horizon.getDate() + TUITION_EXPIRING_SOON_DAYS);
      expiringSoon = end <= horizon;
    }
  }

  return lowSessions || expiringSoon ? 'sap_het' : 'dang_hoc';
}

/** Gói buổi → số buổi (khớp options `TuitionCycles.package`). */
const PACKAGE_SESSIONS: Record<TuitionCycle['package'], number> = {
  '10': 10,
  '20': 20,
  '40': 40,
};

/**
 * Tần suất ƯỚC LƯỢNG để GỢI Ý ngày hết gói (buổi/tuần). Chỉ là điểm khởi đầu cho
 * nhân viên sửa theo lịch lớp thực tế — KHÔNG phải quy tắc nghiệp vụ cứng.
 */
export const SESSIONS_PER_WEEK_ESTIMATE = 2;

/**
 * Gợi ý ngày dự kiến hết gói = ngày bắt đầu + ⌈số buổi / tần suất ước lượng⌉ tuần.
 * THUẦN, trả 'yyyy-mm-dd' (UTC) để gắn vào `<input type="date">`. startDate rỗng/
 * không hợp lệ hoặc gói lạ ⇒ '' (không gợi ý). Dùng cho form duyệt gia hạn nhằm
 * khuyến khích điền `expectedEndDate` (chu kỳ không có ngày hết sẽ không bao giờ
 * kích "sắp hết hạn", chỉ kích theo số buổi).
 */
export function suggestExpectedEndDate(
  startDate: string,
  pkg: TuitionCycle['package'],
): string {
  if (!startDate) return '';
  const d = new Date(startDate);
  if (Number.isNaN(d.getTime())) return '';
  const sessions = PACKAGE_SESSIONS[pkg];
  if (!sessions) return '';
  const weeks = Math.ceil(sessions / SESSIONS_PER_WEEK_ESTIMATE);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
