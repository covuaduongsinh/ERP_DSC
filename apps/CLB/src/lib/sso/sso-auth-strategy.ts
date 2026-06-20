import type { AuthStrategy } from 'payload'
import { STAFF_SSO_COOKIE, verifyStaffSsoToken } from './sso-session'

/**
 * Custom auth strategy cho NHÂN VIÊN qua SSO Keycloak (collection `users`).
 *
 * Payload gọi `authenticate` mỗi request: đọc cookie `ds-staff-sso` (HMAC-signed
 * sau khi callback xác thực Keycloak), verify, load user từ DB → trả `{ user }`.
 * Local strategy (email/mật khẩu) VẪN bật song song làm fallback — nếu đã có
 * `payload-token` thì nhường cho local strategy xử lý.
 */
export const keycloakStaffStrategy: AuthStrategy = {
  name: 'keycloak-staff-sso',
  authenticate: async ({ payload, headers }) => {
    const cookieHeader = headers.get('cookie')
    if (!cookieHeader) return { user: null }

    const cookies = parseCookies(cookieHeader)
    // Đã đăng nhập local (payload-token) → để local strategy lo.
    if (cookies['payload-token']) return { user: null }

    const token = cookies[STAFF_SSO_COOKIE]
    if (!token) return { user: null }

    const session = verifyStaffSsoToken(token)
    if (!session) return { user: null }

    try {
      const user = await payload.findByID({
        collection: 'users',
        id: session.userId,
        overrideAccess: true,
        depth: 0,
      })
      if (!user) return { user: null }
      // Payload cần `collection` để biết nguồn user (mirror parentAuthStrategy).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { user: { ...user, collection: 'users' } } as any
    } catch {
      return { user: null }
    }
  },
}

function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('='))
  }
  return out
}
