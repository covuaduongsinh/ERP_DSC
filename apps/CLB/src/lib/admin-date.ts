import type { DateField } from 'payload'

/**
 * Định dạng ngày DẠNG SỐ dùng chung cho admin Payload (per-field
 * `admin.date`). Mục đích: hiển thị dd/MM/yyyy thay cho mặc định
 * "May 28th 2026, 7:00 AM" — dễ đọc/đối soát. Chỉ ảnh hưởng HIỂN THỊ ở admin,
 * không đổi dữ liệu lưu (timestamptz). Khai 1 chỗ để mọi field nhất quán.
 */
type DateAdmin = NonNullable<NonNullable<DateField['admin']>['date']>

/** Ngày nghiệp vụ (không cần giờ): điểm danh, nộp tiền, chu kỳ, ngày sinh… */
export const DATE_ONLY: DateAdmin = {
  displayFormat: 'dd/MM/yyyy',
  pickerAppearance: 'dayOnly',
}

/** Field có ý nghĩa thời điểm (giữ giờ): hẹn follow-up, sự kiện, đăng nhập… */
export const DATE_TIME: DateAdmin = {
  displayFormat: 'dd/MM/yyyy HH:mm',
  pickerAppearance: 'dayAndTime',
}
