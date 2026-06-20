/**
 * Chuẩn hóa & kiểm tra SĐT Việt Nam.
 * Port từ CLB (apps/CLB/src/lib/phone.ts) để dò trùng Contact↔Parent nhất quán
 * giữa CRM và CLB khi nhận lead từ form web.
 */

/** Bỏ khoảng trắng, dấu chấm, gạch, ngoặc. */
export function normalizePhone(input: string): string {
  return input.replace(/[\s.\-()]/g, "");
}

/** SĐT di động VN: 0/84/+84 + đầu số 3|5|7|8|9 + 8 chữ số. */
export function isValidVietnamesePhone(input: string): boolean {
  const phone = normalizePhone(input);
  return /^(?:\+?84|0)(?:3|5|7|8|9)\d{8}$/.test(phone);
}
