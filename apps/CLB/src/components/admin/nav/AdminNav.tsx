import { cookies, headers } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { getStaffQueueCounts } from '@/lib/staff-queues'
import { ADMIN_BRANCH_COOKIE, getBranchContext } from '@/lib/admin-branch'
import type { Location, User } from '@/payload-types'
import { AdminNavClient } from './AdminNavClient'
import type { BranchOption } from './BranchSwitcher'
import { ROLE_META, primaryRole, roleLabels } from './adminNavConfig'

/**
 * Sidebar /admin tùy biến (đăng ký `admin.components.Nav`) — THAY TOÀN BỘ nav mặc
 * định của Payload bằng sidebar navy gom-nhóm + lọc theo role + badge hàng đợi +
 * bộ chọn cơ sở. Server Component: resolve nhân viên từ phiên, đếm hàng đợi
 * (role-aware, `overrideAccess:false`), nạp danh sách cơ sở; phần tương tác
 * (active link, dropdown cơ sở) ở `AdminNavClient`.
 *
 * 🔒 Đây chỉ là UX (ẩn/hiện link + thu hẹp cơ sở). Hàng rào THẬT vẫn ở access/*.
 */

/**
 * Mã ngắn cơ sở: chữ đầu mỗi từ, BỎ tiền tố chung ("Cơ sở", "Trụ sở chính") +
 * ký tự ngăn cách để mã PHÂN BIỆT được.
 * "Cơ sở Kim Liên — Đống Đa" → KL · "Cơ sở Vĩnh Phúc - Ba Đình" → VP ·
 * "Trụ sở chính Tôn Đức Thắng" → TĐ.
 */
function branchShort(name: string): string {
  const cleaned = name.replace(/^\s*(cơ sở|trụ sở chính|trụ sở)\s+/iu, '').replace(/[-–—]/g, ' ')
  const words = cleaned
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}/u.test(w))
  const initials = words
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return initials.slice(0, 2) || name.trim().slice(0, 2).toUpperCase()
}

/** Chữ avatar suy từ email (vd letan.kl → LE). */
function avatarFrom(email: string): string {
  const local = email.split('@')[0] ?? ''
  const parts = local.split(/[.\-_]+/).filter(Boolean)
  const text = parts.length >= 2 ? parts[0][0] + parts[1][0] : local.slice(0, 2)
  return (text || '?').toUpperCase()
}

export async function AdminNav() {
  const payload = await getPayloadClient()
  const headersList = await headers()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })

  // Chỉ nhân viên (collection `users`) thấy nav này; trang đăng nhập (no user) ⇒ ẩn.
  if (!user || user.collection !== 'users') return null
  const staff = user as User
  const roles = staff.role // hasMany ⇒ mảng vai trò

  const cookieStore = await cookies()
  const cookieVal = cookieStore.get(ADMIN_BRANCH_COOKIE)?.value
  const branch = getBranchContext(staff, cookieVal)

  const [locationsResult, counts] = await Promise.all([
    payload.find({
      collection: 'locations',
      sort: '-isHeadquarters',
      limit: 50,
      depth: 0,
      pagination: false,
      user: staff,
      overrideAccess: false,
    }),
    getStaffQueueCounts(),
  ])

  const allLocations: BranchOption[] = (locationsResult.docs as Location[]).map((l) => ({
    id: l.id as number,
    name: l.name,
    short: branchShort(l.name),
  }))

  // Vai trò khóa CHỈ thấy cơ sở của mình làm lựa chọn; global thấy tất cả.
  const branchOptions =
    branch.allowedIds == null
      ? allLocations
      : allLocations.filter((o) => branch.allowedIds!.includes(o.id))

  const allLabel = branch.locked ? 'Tất cả cơ sở của bạn' : 'Tất cả cơ sở'

  const active = branch.active
  const scopeLabel =
    active === 'all'
      ? 'Toàn hệ thống'
      : active.length === 0
        ? 'Chưa gán cơ sở'
        : active.length === 1
          ? (branchOptions.find((o) => o.id === active[0])?.name ?? '—')
          : branch.locked
            ? 'Cơ sở của bạn'
            : 'Nhiều cơ sở'

  return (
    <AdminNavClient
      roles={roles}
      counts={{
        leads: counts.uncaredLeads,
        renewals: counts.pendingRenewalRequests,
        reports: counts.draftProgressReports,
      }}
      branchOptions={branchOptions}
      branchActive={active}
      branchCanChoose={branch.canChoose}
      branchLocked={branch.locked}
      branchAllLabel={allLabel}
      scopeLabel={scopeLabel}
      roleLabel={roleLabels(roles)}
      avatarColor={ROLE_META[primaryRole(roles)].color}
      avatarText={avatarFrom(staff.email)}
      userEmail={staff.email}
    />
  )
}

export default AdminNav
