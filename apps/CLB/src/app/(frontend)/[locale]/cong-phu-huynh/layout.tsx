import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Cổng phụ huynh KHÔNG được search engine index. Dữ liệu học viên là riêng tư:
 * noindex/nofollow áp cho toàn bộ /cong-phu-huynh/* (kể cả trang đăng nhập).
 * Kết hợp với disallow trong robots.ts và middleware chặn truy cập chưa đăng nhập.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
}

export default function ParentPortalLayout({ children }: { children: ReactNode }) {
  return children
}
