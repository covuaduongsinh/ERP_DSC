import { headers } from 'next/headers';
import { getPayloadClient } from '@/lib/payload';
import type { User } from '@/payload-types';
import { navForRoles } from '../nav/adminNavConfig';
import { QuickCreateClient } from './QuickCreateClient';

/**
 * Nút "＋ Tạo nhanh" trên topbar admin (đăng ký `admin.components.actions`).
 * Server Component: resolve nhân viên từ phiên + danh sách route id được THẤY
 * (theo role, UX). Dropdown lối tắt nghiệp vụ chính (gập từ "Tác vụ nhanh" cũ
 * trong sidebar) — lọc theo `ROLE_NAV`.
 *
 * 🔒 Chỉ ẩn/hiện lối tắt (UX). Hàng rào THẬT vẫn ở access/* (server-side) trong
 * từng view/collection đích.
 */
export async function QuickCreateAction() {
  const payload = await getPayloadClient();
  const headersList = await headers();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });

  // Chỉ nhân viên (collection `users`) thấy nút này; trang đăng nhập ⇒ ẩn.
  if (!user || user.collection !== 'users') return null;
  const staff = user as User;

  const allowed = Array.from(navForRoles(staff.role));

  return <QuickCreateClient allowed={allowed} />;
}

export default QuickCreateAction;
