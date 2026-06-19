import { Fragment } from 'react';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { Check, Minus } from 'lucide-react';
import { isAdmin, RENEWAL_PROCESSOR_ROLES, REPORT_VIEWER_ROLES, type UserRole } from '@/access';
import { GLOBAL_BRANCH_ROLES } from '@/access/branch';
import { ROLE_META } from '@/components/admin/nav/adminNavConfig';

/**
 * Ma trận phân quyền (`/admin/phan-quyen`) — TÀI LIỆU SỐNG, đọc-only.
 *
 * Sinh trực tiếp từ các hằng access THẬT (`GLOBAL_BRANCH_ROLES`,
 * `RENEWAL_PROCESSOR_ROLES`, `REPORT_VIEWER_ROLES`…) nên không lệch với hành vi
 * thực tế. Gate xem = `isAdmin`. Đây CHỈ là tài liệu — hàng rào thật vẫn ở
 * access/* + collection access. Nguồn đối chiếu: docs/security-access-control.md.
 */

// Thứ tự cột (khớp design ROLE_ORDER).
const ROLE_ORDER: UserRole[] = ['admin', 'manager', 'accountant', 'receptionist', 'coach', 'assistant'];

// Tập vai trò dùng lại (các hằng không export — chú thích nguồn).
const ALL_STAFF: UserRole[] = ['admin', 'manager', 'coach', 'accountant', 'receptionist', 'assistant'];
const CONTENT_ROLES: UserRole[] = ['admin', 'manager', 'receptionist']; // canManageLeads / canManageContent / convertLead

interface Capability {
  label: string;
  roles: readonly UserRole[];
  note?: string;
}
interface CapGroup {
  group: string;
  caps: Capability[];
}

const GROUPS: CapGroup[] = [
  {
    group: 'Phạm vi cơ sở',
    caps: [
      {
        label: 'Xem/ghi mọi cơ sở (global)',
        roles: GLOBAL_BRANCH_ROLES,
        note: 'Vai trò khác bị khóa theo users.location (fail-closed nếu chưa gán)',
      },
    ],
  },
  {
    group: 'Tuyển sinh (CRM)',
    caps: [
      { label: 'Quản lý lead — pipeline (đọc/ghi)', roles: CONTENT_ROLES },
      { label: 'Chuyển đổi lead → Phụ huynh + Học viên', roles: CONTENT_ROLES },
    ],
  },
  {
    group: 'Đào tạo (vận hành)',
    caps: [
      { label: 'Điểm danh / nhận xét buổi', roles: ALL_STAFF, note: 'staffOnly — mọi nhân viên (đọc theo cơ sở)' },
      { label: 'Soạn & phát hành báo cáo tiến độ', roles: ALL_STAFF },
      { label: 'Sửa hồ sơ học viên', roles: ALL_STAFF, note: 'theo cơ sở (withBranchScope)' },
    ],
  },
  {
    group: 'Nội dung & cơ sở',
    caps: [{ label: 'Quản lý lớp / cơ sở / giáo viên / bài viết / sự kiện', roles: CONTENT_ROLES }],
  },
  {
    group: 'Tài chính',
    caps: [
      { label: 'Nhập học phí (Thu)', roles: ALL_STAFF, note: 'staffOnly' },
      { label: 'Duyệt yêu cầu gia hạn', roles: RENEWAL_PROCESSOR_ROLES },
      { label: 'Phiếu chi — xem', roles: ['admin', 'manager', 'accountant'] },
      { label: 'Phiếu chi — ghi', roles: ['admin', 'accountant'] },
    ],
  },
  {
    group: 'Quản trị hệ thống',
    caps: [
      { label: 'Xem báo cáo KPI', roles: REPORT_VIEWER_ROLES },
      { label: 'Quản lý người dùng', roles: ['admin', 'manager'] },
      { label: 'Nhật ký kiểm toán', roles: ['admin'] },
    ],
  },
];

function roleHas(roles: readonly UserRole[], role: UserRole): boolean {
  return (roles as readonly string[]).includes(role);
}

export async function PermissionMatrixView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const {
    req,
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult;

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên.</p>
      </Gutter>
    );
  }
  const allowed = isAdmin({ req }) === true;

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <header className="ds-pghead" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="ds-pghead__h1">Ma trận phân quyền</h1>
            <p className="ds-pghead__sub">
              Tài liệu sống — sinh từ <code>access/roles.ts</code> + các gate <code>hasRole(…)</code>. Hàng rào thật ở
              tầng access (server-side), không chỉ ẩn UI.
            </p>
          </div>
        </header>

        {allowed ? (
          <div className="ds-panel">
            <div className="ds-matrix-wrap">
              <table className="ds-matrix">
                <thead>
                  <tr>
                    <th scope="col">Khả năng</th>
                    {ROLE_ORDER.map((r) => (
                      <th key={r} scope="col">
                        <span className="ds-matrix__role">
                          <span className="ds-matrix__dot" style={{ background: ROLE_META[r].color }} />
                          {ROLE_META[r].label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {GROUPS.map((g) => (
                    <Fragment key={g.group}>
                      <tr className="ds-matrix__grouprow">
                        <th scope="colgroup" colSpan={ROLE_ORDER.length + 1}>
                          {g.group}
                        </th>
                      </tr>
                      {g.caps.map((cap) => (
                        <tr key={cap.label}>
                          <td>
                            {cap.label}
                            {cap.note && <span className="ds-matrix__note">{cap.note}</span>}
                          </td>
                          {ROLE_ORDER.map((r) => {
                            const yes = roleHas(cap.roles, r);
                            return (
                              <td key={r} className="ds-matrix__cell" data-yes={yes ? 'y' : 'n'}>
                                {yes ? (
                                  <Check className="ds-matrix__yes" aria-label="có" />
                                ) : (
                                  <Minus className="ds-matrix__no" aria-label="không" />
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p role="alert" style={{ color: 'var(--theme-warning-600)', fontWeight: 600 }}>
            Chỉ admin mới xem được ma trận phân quyền.
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default PermissionMatrixView;
