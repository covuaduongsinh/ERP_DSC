import crypto from 'node:crypto';

// ---------------------------------------------------------------------------
// Sinh mã & băm
// ---------------------------------------------------------------------------

/** Sinh mã 6 số an toàn (cryptographic RNG). */
export function generateOtpCode(): string {
  // 0..999999 → pad 6 chữ số
  const n = crypto.randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

/**
 * Băm OTP trước khi lưu DB. Không lưu plaintext — kẻ tấn công đọc được DB
 * cũng không dùng được mã.
 */
export function hashOtpCode(code: string): string {
  const pepper = process.env.PARENT_SESSION_SECRET ?? '';
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export const OTP_TTL_MS = 5 * 60 * 1000; // 5 phút
export const OTP_MAX_ATTEMPTS = 5; // số lần nhập sai trước khi vô hiệu OTP
