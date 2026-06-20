import type { CollectionConfig } from 'payload'
import { hasRole } from '../access'
import { staffOnly } from '../access/parents'
import { DEFAULT_USER_ROLE, USER_ROLE_OPTIONS } from '../access/roles'
import { buildAuditHooks } from '../lib/audit/log'
import { keycloakStaffStrategy } from '../lib/sso/sso-auth-strategy'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    group: 'Hệ thống',
    useAsTitle: 'email',
  },
  // SSO Keycloak (ERP dùng chung) + GIỮ local email/mật khẩu làm fallback.
  // Không `disableLocalStrategy` → vẫn đăng nhập được bằng tài khoản Payload cũ.
  auth: {
    strategies: [keycloakStaffStrategy],
  },
  // Quản lý tài khoản (tạo/sửa/xóa): chỉ admin + manager. Đọc: mọi nhân viên
  // (để /admin resolve quan hệ → users), nhưng KHÔNG cho phụ huynh đọc danh
  // sách nhân viên (staffOnly chặn collection 'parents').
  access: {
    create: hasRole('admin', 'manager'),
    read: staffOnly,
    update: hasRole('admin', 'manager'),
    delete: hasRole('admin', 'manager'),
  },
  // Audit: ghi diff tối thiểu (CHỈ email + role + location — KHÔNG BAO GIỜ
  // password/hash). `location` được audit vì đổi cơ sở của nhân viên là đổi
  // phạm vi truy cập (phân quyền theo cơ sở 🔒).
  hooks: buildAuditHooks('users'),
  fields: [
    // Email added by default
    {
      // GIỮ tên field `role` (số nhiều về NGHĨA — đây là MẢNG vai trò vì hasMany).
      // Không đổi tên thành `roles` để tránh drizzle-kit hỏi rename (treo migrate:create).
      // Quyền của nhân viên = HỢP của các vai trò trong mảng này.
      name: 'role',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: [DEFAULT_USER_ROLE],
      options: USER_ROLE_OPTIONS,
      label: 'Vai trò',
      admin: {
        description:
          'Một nhân viên có thể có NHIỀU vai trò (quyền là HỢP của các vai trò). ' +
          'Quyết định phạm vi truy cập. Mặc định "Lễ tân" (quyền thấp nhất).',
      },
    },
    {
      // GIỮ tên field `location` (là MẢNG cơ sở vì hasMany) — tránh rename prompt.
      name: 'location',
      type: 'relationship',
      relationTo: 'locations',
      hasMany: true,
      label: 'Cơ sở',
      admin: {
        description:
          'Cơ sở của nhân viên (có thể NHIỀU). Vai trò bị-khóa-theo-cơ-sở ' +
          '(coach, receptionist, assistant) CHỈ đọc/sửa Học viên + Lớp thuộc các cơ sở này. ' +
          'Vai trò global (admin, manager, accountant) xem mọi cơ sở nên không cần gán. ' +
          'BỎ TRỐNG ở vai trò bị-khóa ⇒ không thấy dữ liệu nào (fail-closed).',
      },
    },
  ],
}
