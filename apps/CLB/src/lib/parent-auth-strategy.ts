import type { AuthStrategy } from 'payload'
import { PARENT_SESSION_COOKIE, verifyParentSessionToken } from './parent-session'

/**
 * Custom auth strategy cho Parents collection.
 *
 * Payload gọi `authenticate` cho mỗi request. Ta đọc cookie `ds-parent-session`
 * (HMAC-signed), verify, rồi load parent từ DB. Trả `{ user }` để Payload set
 * `req.user`, từ đó access control (xem `access/parents.ts`) chạy đúng.
 *
 * Cookie này TÁCH RIÊNG khỏi `payload-token` của staff — staff đăng nhập
 * /admin KHÔNG tự động trở thành phụ huynh và ngược lại.
 */
export const parentAuthStrategy: AuthStrategy = {
  name: 'parent-session-cookie',
  authenticate: async ({ payload, headers }) => {
    // Không áp dụng session phụ huynh trên /admin — nhân viên dùng payload-token.
    if (shouldSkipParentAuth(headers)) {
      return { user: null }
    }

    const cookieHeader = headers.get('cookie')
    if (!cookieHeader) return { user: null }

    const cookies = parseCookies(cookieHeader)
    if (cookies['payload-token']) return { user: null }

    const token = cookies[PARENT_SESSION_COOKIE]
    if (!token) return { user: null }

    const session = verifyParentSessionToken(token)
    if (!session) return { user: null }

    try {
      const parent = await payload.findByID({
        collection: 'parents',
        id: session.parentId,
        overrideAccess: true,
        depth: 0,
      })
      if (!parent) return { user: null }

      // Payload yêu cầu user có `collection` để biết collection nguồn.
      // Cast qua AuthStrategyResult["user"] ngầm để bypass generic User type.
      return {
        user: { ...parent, collection: 'parents' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any
    } catch {
      return { user: null }
    }
  },
}

function shouldSkipParentAuth(headers: Headers): boolean {
  if (headers.get('x-ds-skip-parent-auth') === '1') return true

  const referer = headers.get('referer')
  if (referer) {
    try {
      if (new URL(referer).pathname.startsWith('/admin')) return true
    } catch {
      /* ignore malformed referer */
    }
  }
  return false
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
