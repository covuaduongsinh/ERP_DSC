import { NextResponse, type NextRequest } from 'next/server';
import { buildLogoutUrl, ssoConfigured } from '@/lib/sso/keycloak';
import { STAFF_SSO_COOKIE } from '@/lib/sso/sso-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Đăng xuất SSO: xóa cookie session staff rồi (nếu SSO bật) chuyển sang trang
 * logout của Keycloak để kết thúc phiên SSO chung. Không bật SSO → về /admin/login.
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SERVER_URL || req.nextUrl.origin;
  const target = ssoConfigured()
    ? buildLogoutUrl({ redirectUri: `${origin}/admin/login` })
    : `${origin}/admin/login`;

  const res = NextResponse.redirect(target);
  res.cookies.delete(STAFF_SSO_COOKIE);
  return res;
}
