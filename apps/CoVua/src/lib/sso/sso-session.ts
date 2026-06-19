import crypto from 'node:crypto';

/**
 * Session token cho NHÂN VIÊN đăng nhập qua SSO Keycloak (ERP dùng chung).
 *
 * Tách biệt với:
 *  - `payload-token` (đăng nhập local email/mật khẩu trên /admin — vẫn giữ làm fallback).
 *  - `ds-parent-session` (cổng phụ huynh, xem [[parent-session]]).
 *
 * Cơ chế: HMAC-SHA256 ký bằng SSO_SESSION_SECRET (fallback PAYLOAD_SECRET) —
 * KHÔNG cần thư viện ngoài, mô phỏng đúng lib/parent-session.ts.
 */

const COOKIE_NAME = 'ds-staff-sso';
const DEFAULT_TTL_SECONDS = 60 * 60 * 8; // 8 giờ (1 ca làm việc)

export type StaffSsoPayload = {
  userId: number;
  email: string;
  iat: number; // unix seconds
  exp: number; // unix seconds
};

function getSecret(): string {
  const secret = process.env.SSO_SESSION_SECRET || process.env.PAYLOAD_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'SSO_SESSION_SECRET/PAYLOAD_SECRET chưa set hoặc < 32 ký tự — không thể ký session SSO.',
    );
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64url');
}

function sign(payload: StaffSsoPayload): string {
  const body = base64url(JSON.stringify(payload));
  const sig = base64url(
    crypto.createHmac('sha256', getSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

function verify(token: string): StaffSsoPayload | null {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = base64url(
      crypto.createHmac('sha256', getSecret()).update(body).digest(),
    );
  } catch {
    // Thiếu secret → coi như token không hợp lệ thay vì crash request (strategy
    // chạy trên MỌI request).
    return null;
  }

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as StaffSsoPayload;
    if (typeof parsed.userId !== 'number') return null;
    if (typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function createStaffSsoToken(
  userId: number,
  email: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): { token: string; payload: StaffSsoPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: StaffSsoPayload = { userId, email, iat: now, exp: now + ttlSeconds };
  return { token: sign(payload), payload };
}

export function verifyStaffSsoToken(token: string): StaffSsoPayload | null {
  return verify(token);
}

export const STAFF_SSO_COOKIE = COOKIE_NAME;
export const STAFF_SSO_TTL_SECONDS = DEFAULT_TTL_SECONDS;
export const SSO_STATE_COOKIE = 'ds-sso-state';
