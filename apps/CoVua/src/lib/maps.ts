import type { Location } from '@/payload-types';

/** URL `src` cho iframe bản đồ: ưu tiên mapEmbedUrl, sau đó lat/lng. */
export function getMapEmbedSrc(location: Location): string | null {
  const embed = location.mapEmbedUrl?.trim();
  if (embed) {
    const iframeMatch = embed.match(/src=["']([^"']+)["']/i);
    if (iframeMatch?.[1]) {
      return iframeMatch[1];
    }
    return embed;
  }

  if (location.lat != null && location.lng != null) {
    return `https://www.google.com/maps?q=${location.lat},${location.lng}&hl=vi&z=16&output=embed`;
  }

  return null;
}

/** Link "Chỉ đường" Google Maps: ưu tiên toạ độ, sau đó tìm theo tên + địa chỉ. */
export function getDirectionsUrl(location: Location): string {
  if (location.lat != null && location.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
  }
  const query = encodeURIComponent(
    `${location.name} ${location.address ?? ''}`.trim(),
  );
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
