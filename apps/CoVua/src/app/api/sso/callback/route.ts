import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  mapKeycloakRolesToPayload,
} from '@/lib/sso/keycloak';
import {
  createStaffSsoToken,
  STAFF_SSO_COOKIE,
  STAFF_SSO_TTL_SECONDS,
  SSO_STATE_COOKIE,
} from '@/lib/sso/sso-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Keycloak gọi lại sau khi nhân viên đăng nhập:
 *  1. Kiểm tra `state` khớp cookie (chống CSRF).
 *  2. Đổi code → tokens, lấy userinfo (email + roles).
 *  3. Tìm-hoặc-tạo user Payload theo email, đồng bộ vai trò mỗi lần đăng nhập.
 *  4. Set cookie session `ds-staff-sso` (HMAC) rồi đưa về /admin.
 */
export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SERVER_URL || req.nextUrl.origin;
  const url = req.nextUrl;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(SSO_STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(`${origin}/admin/login?error=sso_state`);
  }

  const redirectUri = `${origin}/api/sso/callback`;
  try {
    const tokens = await exchangeCodeForTokens({ code, redirectUri });
    const info = await fetchUserInfo(tokens.access_token);
    const email = (info.email || info.preferred_username || '').toLowerCase();
    if (!email) {
      return NextResponse.redirect(`${origin}/admin/login?error=sso_no_email`);
    }

    const roles = mapKeycloakRolesToPayload(info);
    const payload = await getPayloadClient();

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    let userId: number;
    if (existing.docs.length > 0) {
      userId = existing.docs[0].id as number;
      // Đồng bộ vai trò từ Keycloak (nguồn sự thật về quyền) mỗi lần đăng nhập.
      await payload.update({
        collection: 'users',
        id: userId,
        data: { role: roles },
        overrideAccess: true,
      });
    } else {
      // Auto-provision: tạo tài khoản nhân viên lần đầu đăng nhập SSO.
      // Mật khẩu ngẫu nhiên (không dùng) vì local strategy vẫn bật về kỹ thuật.
      const created = await payload.create({
        collection: 'users',
        data: {
          email,
          role: roles,
          password: crypto.randomBytes(24).toString('hex'),
        },
        overrideAccess: true,
      });
      userId = created.id as number;
    }

    const { token } = createStaffSsoToken(userId, email);
    const res = NextResponse.redirect(`${origin}/admin`);
    res.cookies.set(STAFF_SSO_COOKIE, token, {
      httpOnly: true,
      secure: origin.startsWith('https'),
      sameSite: 'lax',
      path: '/',
      maxAge: STAFF_SSO_TTL_SECONDS,
    });
    res.cookies.delete(SSO_STATE_COOKIE);
    return res;
  } catch (err) {
    console.error('[SSO] callback error:', err);
    return NextResponse.redirect(`${origin}/admin/login?error=sso_failed`);
  }
}
