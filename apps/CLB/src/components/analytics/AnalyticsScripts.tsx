import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics'
import { FacebookPixel } from '@/components/analytics/FacebookPixel'

export function AnalyticsScripts() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID?.trim()
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim()

  if (!gaId && !pixelId) {
    return null
  }

  return (
    <>
      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
      {pixelId ? <FacebookPixel pixelId={pixelId} /> : null}
    </>
  )
}
