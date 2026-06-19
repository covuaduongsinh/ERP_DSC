/**
 * Phân giải mã cơ sở ({CS}) cho mã định danh nghiệp vụ.
 *
 * Hai nhánh:
 *  - `coSo` (Phase 1): Payments/Refunds/BookIssues dùng field select
 *    `kim_lien`/`vinh_phuc` → map tĩnh KL/VP.
 *  - `locationId` (Phase 3): Classes dùng quan hệ `location` → đọc
 *    `Locations.code` ('KL'/'VP') qua Local API (`overrideAccess:true`,
 *    `depth:0`). Cache theo request (`req`) để N create cùng location trong 1
 *    request không gọi findByID lặp.
 */
import type { PayloadRequest } from 'payload';
import { branchFromCoSo, type BranchCode } from './format';

export type ResolveBranchInput = {
  /** Field select trên Payments/Refunds/BookIssues (Phase 1). */
  coSo?: unknown;
  /**
   * Quan hệ `location` → locations (Phase 3 — Classes). Nhận giá trị THÔ của
   * field relationship: số id, chuỗi số, hoặc `{ id }` (Payload depth>0).
   */
  locationId?: unknown;
};

/** Cache `locationId → Locations.code` gắn vào request (tránh findByID lặp). */
type LocationCodeCache = Map<number, BranchCode | null>;

const LOCATION_CODE_CACHE = new WeakMap<object, LocationCodeCache>();

function getLocationCache(req: PayloadRequest): LocationCodeCache {
  let cache = LOCATION_CODE_CACHE.get(req as object);
  if (!cache) {
    cache = new Map();
    LOCATION_CODE_CACHE.set(req as object, cache);
  }
  return cache;
}

/** Chuẩn hóa `Locations.code` thô về 'KL'/'VP' (HOA, trim); null nếu không hợp lệ. */
function normalizeLocationCode(raw: unknown): BranchCode | null {
  if (typeof raw !== 'string') return null;
  const up = raw.trim().toUpperCase();
  if (up === 'KL' || up === 'VP') return up;
  return null;
}

/**
 * Đọc `Locations.code` cho `locationId` (cache theo request). Local API
 * `overrideAccess:true` (hook nghiệp vụ, không phụ thuộc vai trò người gọi);
 * `depth:0` (chỉ cần field scalar `code`). Lỗi/không thấy → null.
 */
async function resolveLocationCode(
  req: PayloadRequest,
  locationId: number,
): Promise<BranchCode | null> {
  const cache = getLocationCache(req);
  if (cache.has(locationId)) return cache.get(locationId) ?? null;

  let code: BranchCode | null = null;
  try {
    const doc = await req.payload.findByID({
      collection: 'locations',
      id: locationId,
      overrideAccess: true,
      depth: 0,
    });
    code = normalizeLocationCode((doc as { code?: unknown } | null)?.code);
  } catch {
    code = null;
  }

  cache.set(locationId, code);
  return code;
}

/** Lấy id quan hệ từ giá trị field relationship (số | {id} | chuỗi số). */
function toLocationId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (value && typeof value === 'object') {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'number' && Number.isFinite(id)) return id;
    if (typeof id === 'string' && id.trim() !== '') {
      const n = Number(id);
      return Number.isFinite(n) ? n : null;
    }
  }
  return null;
}

/**
 * Trả mã cơ sở 2 ký tự ('KL'/'VP') hoặc `null` nếu không phân giải được.
 *
 * Ưu tiên `coSo` (Phase 1). Nếu không có và có `locationId` (Phase 3) → đọc
 * `Locations.code`. Caller (makeCodeHook) throw lỗi rõ ràng khi cần cơ sở mà
 * cả hai null.
 */
export async function resolveBranchCode(
  req: PayloadRequest,
  input: ResolveBranchInput,
): Promise<BranchCode | null> {
  const fromCoSo = branchFromCoSo(input.coSo);
  if (fromCoSo) return fromCoSo;

  const locationId = toLocationId(input.locationId);
  if (locationId != null) {
    return resolveLocationCode(req, locationId);
  }

  return null;
}
