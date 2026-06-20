import crypto from 'node:crypto'

/**
 * Session token cho phụ huynh — TÁCH BIỆT với cookie `payload-token` của staff.
 *
 * Lý do tách: phụ huynh và nhân viên dùng hai luồng auth khác nhau (OTP vs
 * email/password). Nếu dùng chung cookie, một nhân viên đăng nhập /admin có
 * thể vô tình mang session sang /cong-phu-huynh và ngược lại. Tách cookie
 * + tách secret là cách đơn giản nhất để chống lẫn luồng.
 */

const COOKIE_NAME = 'ds-parent-session'
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 ngày

export type ParentSessionPayload = {
  parentId: number
  // Unix seconds
  iat: number
  exp: number
}

function getSecret(): string {
  const secret = process.env.PARENT_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'PARENT_SESSION_SECRET chưa được set hoặc quá ngắn (>=32 ký tự). ' +
        'Kiểm tra .env trước khi chạy auth phụ huynh.',
    )
  }
  return secret
}

/** Kiểm tra nhanh không throw — dùng ở Server Action để fail-fast với message rõ ràng. */
export function isParentSessionSecretConfigured(): boolean {
  const s = process.env.PARENT_SESSION_SECRET
  return !!s && s.length >= 32
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64url')
}

function sign(payload: ParentSessionPayload): string {
  const body = base64url(JSON.stringify(payload))
  const sig = base64url(crypto.createHmac('sha256', getSecret()).update(body).digest())
  return `${body}.${sig}`
}

function verify(token: string): ParentSessionPayload | null {
  if (!token || !token.includes('.')) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null

  let expected: string
  try {
    expected = base64url(crypto.createHmac('sha256', getSecret()).update(body).digest())
  } catch {
    // Thiếu PARENT_SESSION_SECRET → coi như token không hợp lệ thay vì crash
    // request (strategy này chạy trên MỌI request, kể cả /admin của staff).
    return null
  }

  // Constant-time compare để tránh timing attack
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null

  try {
    const parsed = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as ParentSessionPayload

    if (typeof parsed.parentId !== 'number') return null
    if (typeof parsed.exp !== 'number') return null

    const now = Math.floor(Date.now() / 1000)
    if (parsed.exp < now) return null

    return parsed
  } catch {
    return null
  }
}

export function createParentSessionToken(
  parentId: number,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): { token: string; payload: ParentSessionPayload } {
  const now = Math.floor(Date.now() / 1000)
  const payload: ParentSessionPayload = {
    parentId,
    iat: now,
    exp: now + ttlSeconds,
  }
  return { token: sign(payload), payload }
}

export function verifyParentSessionToken(token: string): ParentSessionPayload | null {
  return verify(token)
}

export const PARENT_SESSION_COOKIE = COOKIE_NAME
export const PARENT_SESSION_TTL_SECONDS = DEFAULT_TTL_SECONDS

/** Cookie chỉ gửi tới route cổng PH — không gửi sang /admin (tránh chặn CMS). */
export const PARENT_SESSION_COOKIE_PATHS = ['/cong-phu-huynh', '/en/cong-phu-huynh'] as const
