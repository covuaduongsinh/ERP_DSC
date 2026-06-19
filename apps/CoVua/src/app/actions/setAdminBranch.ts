'use server';

import { cookies, headers } from 'next/headers';
import { getPayloadClient } from '@/lib/payload';
import { isGlobalBranchUser, resolveBranchIds } from '@/access/branch';
import { ADMIN_BRANCH_ALL, ADMIN_BRANCH_COOKIE } from '@/lib/admin-branch';

/**
 * Ghi lựa chọn "cơ sở đang xem" của nhân viên vào cookie (scope '/admin').
 *
 * 🔒 CHỈ vai trò GLOBAL (admin/manager/accountant) được đổi cơ sở. Vai trò
 * khoá-cơ-sở bị ÉP theo `users.location` ở tầng access ⇒ yêu cầu của họ bị bỏ
 * qua (không ghi cookie). Danh tính lấy từ phiên đăng nhập server-side (KHÔNG
 * nhận role/userId từ client). Cookie chỉ THU HẸP hiển thị, không nới quyền —
 * hàng rào thật vẫn ở access/* + `overrideAccess:false`.
 */
export async function setAdminBranch(value: string): Promise<{ ok: boolean }> {
  const payload = await getPayloadClient();
  const headersList = await headers();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });

  if (!user || user.collection !== 'users') return { ok: false };

  // Chuẩn hóa: 'all' hoặc id cơ sở (chuỗi số dương).
  // 🔒 Vai trò KHÓA chỉ được chọn cơ sở THUỘC `users.location` của mình (không nới);
  // vai trò GLOBAL chọn cơ sở bất kỳ. 'all' luôn hợp lệ (= mọi cơ sở / tất cả của mình).
  const n = Number(value);
  let normalized: string;
  if (value === ADMIN_BRANCH_ALL) {
    normalized = ADMIN_BRANCH_ALL;
  } else if (Number.isInteger(n) && n > 0) {
    if (!isGlobalBranchUser(user) && !resolveBranchIds(user).includes(n)) {
      return { ok: false }; // chọn cơ sở ngoài phạm vi ⇒ từ chối
    }
    normalized = String(n);
  } else {
    normalized = ADMIN_BRANCH_ALL;
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_BRANCH_COOKIE, normalized, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/admin',
    maxAge: 60 * 60 * 24 * 30, // 30 ngày
  });

  return { ok: true };
}
