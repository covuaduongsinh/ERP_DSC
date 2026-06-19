import type { Media } from '@/payload-types';

export function getMediaUrl(
  media: number | Media | null | undefined,
): string | null {
  if (!media || typeof media === 'number') {
    return null;
  }
  return media.url ?? null;
}

export function getMediaAlt(
  media: number | Media | null | undefined,
  fallback: string,
): string {
  if (!media || typeof media === 'number') {
    return fallback;
  }
  return media.alt || fallback;
}
