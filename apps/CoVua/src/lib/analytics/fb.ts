export type FBEventParams = Record<
  string,
  string | number | boolean | undefined
>;

function isFbPixelEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_FB_PIXEL_ID?.trim());
}

/** Gửi sự kiện Meta Pixel (chỉ chạy trên client khi đã cấu hình NEXT_PUBLIC_FB_PIXEL_ID). */
export function fbTrack(eventName: string, params?: FBEventParams): void {
  if (typeof window === 'undefined' || !isFbPixelEnabled()) {
    return;
  }

  const fbq = window.fbq;
  if (typeof fbq !== 'function') {
    return;
  }

  if (params && Object.keys(params).length > 0) {
    fbq('track', eventName, params);
  } else {
    fbq('track', eventName);
  }
}
