import 'server-only';
import { cookies } from 'next/headers';
import type { Parent } from '@/payload-types';
import { getPayloadClient } from './payload';
import {
  PARENT_SESSION_COOKIE,
  verifyParentSessionToken,
} from './parent-session';

/**
 * Trả về phụ huynh đang đăng nhập (Server Component / Server Action), hoặc
 * null nếu chưa đăng nhập / cookie hỏng / hết hạn.
 *
 * Đọc trực tiếp cookie + DB thay vì gọi qua Payload `req.user` vì Server
 * Component không có req.
 */
export async function getCurrentParent(): Promise<Parent | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PARENT_SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = verifyParentSessionToken(token);
  if (!session) return null;

  try {
    const payload = await getPayloadClient();
    const parent = await payload.findByID({
      collection: 'parents',
      id: session.parentId,
      overrideAccess: true,
      depth: 1, // load children references
    });
    return parent as Parent;
  } catch {
    return null;
  }
}
