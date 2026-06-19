import { isGlobalBranchUser, resolveBranchIds } from '@/access/branch';
import type { UserRole } from '@/access/roles';

/**
 * "Cơ sở đang xem" cho khu /admin (bộ chọn cơ sở ở sidebar) — MULTI cơ sở.
 *
 * ⚠️ BẤT BIẾN BẢO MẬT 🔒: helper này CHỈ thu hẹp hiển thị (UX). Hàng rào THẬT là
 * access/* với `overrideAccess:false` (vai trò khóa luôn bị `withBranchScope` ép
 * `location IN (các cơ sở của user)`). Vai trò khóa KHÔNG bao giờ xem được cơ sở
 * ngoài `users.location`; cookie chỉ chọn TRONG tập đó. Vai trò GLOBAL chọn được
 * 'all' hoặc 1 cơ sở bất kỳ.
 */

/** Tên cookie lưu lựa chọn cơ sở (scope path '/admin'). */
export const ADMIN_BRANCH_COOKIE = 'ds-admin-branch';
/** Giá trị "mọi cơ sở" trong cookie. */
export const ADMIN_BRANCH_ALL = 'all';

type BranchUser =
  | { collection?: string; role?: UserRole | UserRole[]; location?: unknown }
  | null
  | undefined;

/** Bộ lọc cơ sở áp dụng: 'all' = mọi cơ sở (không lọc); number[] = lọc IN. */
export type ActiveBranch = 'all' | number[];

export interface BranchContext {
  /** Có nhiều hơn 1 lựa chọn để đổi (global luôn true nếu >1 cơ sở; khóa true nếu >1 cơ sở của mình). */
  canChoose: boolean;
  /** Vai trò khóa-cơ-sở (không phải global). */
  locked: boolean;
  /** Cơ sở user ĐƯỢC PHÉP xem: null = global (mọi cơ sở); number[] = chỉ các id này (kể cả rỗng = fail-closed). */
  allowedIds: number[] | null;
  /** Bộ lọc đang áp (sau khi đối chiếu cookie với allowedIds). */
  active: ActiveBranch;
}

/** Cookie chỉ lưu 'all' hoặc MỘT id (người dùng chọn 1 mục). */
function parseBranchCookie(value: string | null | undefined): 'all' | number {
  if (!value || value === ADMIN_BRANCH_ALL) return 'all';
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : 'all';
}

export function getBranchContext(user: BranchUser, cookieValue: string | null | undefined): BranchContext {
  const picked = parseBranchCookie(cookieValue);

  if (isGlobalBranchUser(user)) {
    // Global: 'all' hoặc đúng 1 cơ sở bất kỳ.
    const active: ActiveBranch = picked === 'all' ? 'all' : [picked];
    return { canChoose: true, locked: false, allowedIds: null, active };
  }

  // Vai trò khóa: CHỈ trong cơ sở của mình.
  const mine = resolveBranchIds(user as { collection?: string; location?: unknown });
  if (mine.length === 0) {
    // fail-closed: chưa gán cơ sở ⇒ không thấy gì (IN [] = 0 dòng; access cũng chặn).
    return { canChoose: false, locked: true, allowedIds: [], active: [] };
  }
  // 'all' = tất cả cơ sở của mình; chọn 1 id phải thuộc `mine`, ngoài phạm vi ⇒ ép về tất cả của mình.
  const active: ActiveBranch = picked === 'all' || !mine.includes(picked) ? mine : [picked];
  return { canChoose: mine.length > 1, locked: true, allowedIds: mine, active };
}
