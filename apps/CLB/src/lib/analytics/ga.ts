export type GAEventParams = Record<string, string | number | boolean | undefined>

function isGAEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_GA_ID?.trim())
}

/** Gửi sự kiện tùy chỉnh GA4 (chỉ chạy trên client khi đã cấu hình NEXT_PUBLIC_GA_ID). */
export function trackEvent(name: string, params?: GAEventParams): void {
  if (typeof window === 'undefined' || !isGAEnabled()) {
    return
  }

  const gtag = window.gtag
  if (typeof gtag !== 'function') {
    return
  }

  gtag('event', name, params)
}
