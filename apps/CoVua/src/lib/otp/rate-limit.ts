/**
 * Rate limit GỬI OTP — binding OTP-specific trên engine generic bền-DB.
 *
 * Trước đây dùng `Map` in-memory (reset khi cold start/restart → thủng trên
 * Vercel serverless). Nay đếm qua bảng Postgres `rate_limits` bằng upsert nguyên
 * tử (race-safe), portable Vercel → VPS. Engine chung: `@/lib/rate-limit`.
 *
 * Quy tắc: 3 lần / SĐT / giờ. Khóa = `otp_send:<sdt-đã-chuẩn-hóa>`.
 */
import {
  consumeRateLimit,
  getRateLimitPool,
  type RateLimitResult,
} from '@/lib/rate-limit';

export const OTP_SEND_WINDOW_MS = 60 * 60 * 1000; // 1 giờ
export const OTP_SEND_MAX_PER_WINDOW = 3; // 3 lần / SĐT / giờ

/** Khóa rate-limit theo SĐT đã chuẩn hóa. Tiền tố để dùng chung bảng cho loại khác. */
export const otpSendRateLimitKey = (phone: string): string => `otp_send:${phone}`;

/**
 * Tiêu thụ 1 lần gửi OTP cho SĐT (đã chuẩn hóa) và cho biết đã vượt ngưỡng chưa.
 * Cần `payload` để lấy Postgres pool (`payload.db.pool`). ASYNC — khác bản cũ
 * đồng bộ; gọi trong server action SAU khi đã có payload client.
 */
export async function consumeOtpSendRateLimit(
  payload: { db: unknown },
  phone: string,
): Promise<RateLimitResult> {
  return consumeRateLimit(getRateLimitPool(payload), {
    key: otpSendRateLimitKey(phone),
    max: OTP_SEND_MAX_PER_WINDOW,
    windowMs: OTP_SEND_WINDOW_MS,
  });
}
