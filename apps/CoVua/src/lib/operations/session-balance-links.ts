import type { SessionBalanceMode } from './session-balance';

/**
 * Deep-link tới list view collection của Payload để ĐỐI SOÁT số buổi tồn về
 * bản ghi gốc. KHÔNG `server-only` ⇒ dùng được cả Server Component (trang chi
 * tiết) lẫn Client Component (dòng mở rộng). Định dạng `where[...]` theo mẫu
 * `draftReportsHref` trong StaffQueuesPanel.
 */

/** Phiếu thu `da_nop` của 1 học viên. */
export function paymentsHref(studentId: number): string {
  return (
    `/admin/collections/payments` +
    `?where[and][0][student][equals]=${studentId}` +
    `&where[and][1][tinhTrang][equals]=da_nop`
  );
}

/**
 * Điểm danh `co_mat` ĐƯỢC TÍNH của 1 học viên (cùng cửa sổ với computeBalance):
 *  - `last_payment` : date ≥ đầu ngày anchor.
 *  - `opening`      : date > hết ngày anchor (tức sau ngày chốt số dư).
 *  - `none`/anchor rỗng : toàn bộ co_mat.
 */
export function attendanceHref(
  studentId: number,
  mode: SessionBalanceMode,
  anchorDate: string | null,
): string {
  const parts = [
    `where[and][0][student][equals]=${studentId}`,
    `where[and][1][status][equals]=co_mat`,
  ];
  if (anchorDate) {
    if (mode === 'opening') {
      parts.push(
        `where[and][2][date][greater_than]=${encodeURIComponent(`${anchorDate}T23:59:59.999Z`)}`,
      );
    } else {
      parts.push(
        `where[and][2][date][greater_than_equal]=${encodeURIComponent(`${anchorDate}T00:00:00.000Z`)}`,
      );
    }
  }
  return `/admin/collections/attendance?${parts.join('&')}`;
}

/** Trang đối soát chi tiết 1 học viên. */
export function sessionDetailHref(studentId: number): string {
  return `/admin/so-buoi-ton?student=${studentId}`;
}
