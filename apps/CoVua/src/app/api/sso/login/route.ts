import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { buildAuthorizeUrl, ssoConfigured } from '@/lib/sso/keycloak';
import { SSO_STATE_COOKIE } from '@/lib/sso/sso-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Bắt đầu luồng SSO: tạo `state` chống CSRF, lưu vào cookie ngắn hạn, rồi
 * redirect tới trang đăng nhập Keycloak. Sau khi đăng nhập, Keycloak gọi lại
 * /api/sso/callback.
 */
export async function GET(req: NextRequest) {
  if (!ssoConfigured()) {
    return NextResponse.json(
      { error: 'SSO chưa được cấu hình (thiếu SSO_URL/SSO_CLIENT_SECRET).' },
      { status: 503 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_SERVER_URL || req.nextUrl.origin;
  const redirectUri = `${origin}/api/sso/callback`;
  const state = crypto.randomBytes(16).toString('hex');

  const res = NextResponse.redirect(buildAuthorizeUrl({ state, redirectUri }));
  res.cookies.set(SSO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: origin.startsWith('https'),
    sameSite: 'lax',
    path: '/api/sso',
    maxAge: 600, // 10 phút đủ cho 1 lần đăng nhập
  });
  return res;
}
