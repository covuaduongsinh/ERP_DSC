import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'

const intlMiddleware = createMiddleware(routing)

// Tên cookie phải khớp với PARENT_SESSION_COOKIE trong lib/parent-session.ts.
// Lặp lại hằng số ở đây thay vì import để tránh kéo Node `crypto` vào Edge
// runtime. Middleware CHỈ kiểm tra cookie có/không — verify thật ở page
// (getCurrentParent) chạy Node runtime với HMAC. Cookie giả → page redirect.
const PARENT_COOKIE = 'ds-parent-session'

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // /admin: gắn header để parent auth strategy không chiếm req.user — tránh
  // phụ huynh đang đăng nhập cổng bị đá sang /admin/unauthorized.
  if (pathname.startsWith('/admin')) {
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-ds-skip-parent-auth', '1')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Bảo vệ cổng phụ huynh: mọi /cong-phu-huynh/* ngoại trừ trang đăng nhập
  // đều yêu cầu có cookie session. Hỗ trợ cả prefix locale (/en/cong-phu-huynh).
  const portalMatch = pathname.match(/^\/(?:[a-z]{2}\/)?cong-phu-huynh(?:\/(.*))?$/)
  if (portalMatch) {
    const sub = portalMatch[1] ?? ''
    const isLoginPage = sub === 'dang-nhap' || sub.startsWith('dang-nhap/')
    if (!isLoginPage) {
      const hasCookie = req.cookies.has(PARENT_COOKIE)
      if (!hasCookie) {
        const url = req.nextUrl.clone()
        url.pathname = '/cong-phu-huynh/dang-nhap'
        url.search = ''
        return NextResponse.redirect(url)
      }
    }
  }

  return intlMiddleware(req)
}

export const config = {
  matcher: [
    // Bao gồm /admin (inject header) và các route frontend (intl + cổng PH).
    '/((?!api|my-route|_next|_vercel|.*\\..*).*)',
  ],
}
