import { brand } from '@ds/brand/tokens';
import type { Class, FeaturedBook, Student } from '@/payload-types';

/** Slug CMS ↔ tên quân trong @ds/brand (mapping kỹ thuật, không phải nội dung marketing). */
export const PIECE_TO_LEVEL = {
  Tốt: 'tot',
  Mã: 'ma',
  Tượng: 'tuong',
  Xe: 'xe',
  Hậu: 'hau',
  Vua: 'vua',
} as const satisfies Record<
  (typeof brand.roadmap)[number]['piece'],
  NonNullable<Class['level']>[number]
>;

/** Một cấp độ đơn lẻ — tách khỏi `Class['level']` (nay là MẢNG hasMany). */
export type ChessLevel = NonNullable<Class['level']>[number];

/** Thứ tự cấp độ theo @ds/brand.roadmap. */
export const levelOrder: ChessLevel[] = brand.roadmap.map(
  (step) => PIECE_TO_LEVEL[step.piece],
);

export function formatRoadmapPath(): string {
  return brand.roadmap.map((step) => step.piece).join(' → ');
}

export function getPieceForLevel(level: ChessLevel | FeaturedBook['level']): string {
  if (!level) {
    return '';
  }
  const step = brand.roadmap.find((s) => PIECE_TO_LEVEL[s.piece] === level);
  return step?.piece ?? '';
}

export function getNoteForLevel(level: ChessLevel | FeaturedBook['level']): string {
  if (!level) {
    return '';
  }
  const step = brand.roadmap.find((s) => PIECE_TO_LEVEL[s.piece] === level);
  return step?.note ?? '';
}

/** Map tên tắt cấp độ (Levels.tenTat = tên quân) → ChessLevel slug. */
const PIECE_NAME_TO_LEVEL = PIECE_TO_LEVEL as Record<string, ChessLevel>;

/**
 * Suy ChessLevel từ quan hệ `capChinh` (→Levels) để dùng lại RoadmapProgress.
 * Yêu cầu Levels.tenTat khớp tên quân trong @ds/brand.roadmap (Tốt…Vua).
 * Trả null nếu capChinh chưa populate (number/null) hoặc tenTat không khớp.
 */
export function levelFromCapChinh(
  capChinh: Student['capChinh'],
): ChessLevel | null {
  if (!capChinh || typeof capChinh === 'number') return null;
  return PIECE_NAME_TO_LEVEL[capChinh.tenTat] ?? null;
}

export function chessLevelSelectOptions(): { label: string; value: ChessLevel }[] {
  return brand.roadmap.map((step) => ({
    label: step.piece,
    value: PIECE_TO_LEVEL[step.piece],
  }));
}

// --- Tuyến trình độ (3 tuyến) — gom 6 cấp cho gọn khi trình bày -------------
// Track THUẦN DERIVED từ cấp; nguồn sự thật là `brand.roadmap[].track`.

/** Slug 3 tuyến: Nhập môn / Cơ bản / Nâng cao. */
export type TrackName = (typeof brand.roadmap)[number]['track'];

/** Thứ tự tuyến từ thấp → cao (theo brand.roadmap). */
export const trackOrder: readonly TrackName[] = [
  'nhap_mon',
  'co_ban',
  'nang_cao',
] as const;

/** Nhãn tiếng Việt cho admin (Payload admin không qua next-intl). */
export const TRACK_LABEL: Record<TrackName, string> = {
  nhap_mon: 'Nhập môn',
  co_ban: 'Cơ bản',
  nang_cao: 'Nâng cao',
};

/** Ánh xạ cấp → tuyến, suy từ brand.roadmap (Tốt→nhap_mon; Mã/Tượng/Xe→co_ban; Hậu/Vua→nang_cao). */
export const LEVEL_TO_TRACK: Record<ChessLevel, TrackName> = Object.fromEntries(
  brand.roadmap.map((step) => [PIECE_TO_LEVEL[step.piece], step.track]),
) as Record<ChessLevel, TrackName>;

/** Tuyến của một cấp; null nếu cấp rỗng/không hợp lệ. */
export function getTrackForLevel(
  level: ChessLevel | FeaturedBook['level'] | null | undefined,
): TrackName | null {
  if (!level) {
    return null;
  }
  return LEVEL_TO_TRACK[level as ChessLevel] ?? null;
}

/** Options select cho field `track` (admin) — nhãn Việt theo `trackOrder`. */
export function chessTrackSelectOptions(): { label: string; value: TrackName }[] {
  return trackOrder.map((track) => ({ label: TRACK_LABEL[track], value: track }));
}

/** Ánh xạ ngược tuyến → các cấp thuộc tuyến đó (theo thứ tự brand.roadmap). */
export const TRACK_TO_LEVELS: Record<TrackName, ChessLevel[]> = (() => {
  const map = Object.fromEntries(trackOrder.map((t) => [t, [] as ChessLevel[]])) as Record<
    TrackName,
    ChessLevel[]
  >;
  for (const step of brand.roadmap) {
    map[step.track].push(PIECE_TO_LEVEL[step.piece]);
  }
  return map;
})();

/** Suy tập tuyến (3 tuyến) từ nhiều cấp; dedupe + sắp theo `trackOrder`. THUẦN. */
export function getTracksForLevels(levels: readonly ChessLevel[]): TrackName[] {
  const set = new Set<TrackName>();
  for (const level of levels) {
    const track = getTrackForLevel(level);
    if (track) set.add(track);
  }
  return trackOrder.filter((track) => set.has(track));
}

/** Suy tập cấp từ nhiều tuyến; gom cấp của mỗi tuyến, sắp theo `levelOrder`. THUẦN. */
export function getLevelsForTracks(tracks: readonly TrackName[]): ChessLevel[] {
  const set = new Set<ChessLevel>();
  for (const track of tracks) {
    for (const level of TRACK_TO_LEVELS[track] ?? []) set.add(level);
  }
  return levelOrder.filter((level) => set.has(level));
}
