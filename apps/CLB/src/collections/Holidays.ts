import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { staffOnly } from '../access/parents'
import { canPlanSessions } from '../access'
import { withBranchScopeOrGlobal } from '../access/branch'
import { buildAuditHooks } from '../lib/audit/log'
import { DATE_ONLY } from '../lib/admin-date'

/**
 * LỊCH NGHỈ LỄ — ngày nghỉ toàn công ty hoặc theo cơ sở, để màn "Lập kế hoạch
 * buổi học" TỰ ĐỘNG bỏ qua khi sinh chuỗi buổi `du_kien` (Đợt 1 — bịt rủi ro sinh
 * buổi vào ngày nghỉ). Hỗ trợ nghỉ nhiều ngày (Tết) qua [tuNgay, denNgay].
 *
 * 🔒 Branch-scope:
 *  - `location` để trống = nghỉ TOÀN CÔNG TY; có giá trị = chỉ cơ sở đó.
 *  - TẠO/SỬA/XÓA: chỉ admin/manager (`canPlanSessions` = SESSION_PLANNER_ROLES).
 *  - ĐỌC: staff đọc ngày nghỉ của cơ sở mình + ngày nghỉ toàn công ty
 *    (`withBranchScopeOrGlobal` — giữ cả record `location` null).
 *
 * 🔒 KHÔNG đụng `attendance`/`tuition_cycles`: lịch nghỉ chỉ LỌC ở tầng lập kế
 * hoạch (`session-planning.ts`), KHÔNG chặn ghi điểm danh/dạy bù thực tế.
 */
const fillDenNgay: CollectionBeforeValidateHook = ({ data }) => {
  if (data && data.tuNgay && !data.denNgay) {
    // Nghỉ 1 ngày: để trống "đến ngày" ⇒ điền = "từ ngày" (luôn có khoảng đủ).
    data.denNgay = data.tuNgay
  }
  return data
}

export const Holidays: CollectionConfig = {
  slug: 'holidays',
  labels: {
    singular: 'Ngày nghỉ',
    plural: 'Lịch nghỉ',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'tenNgayNghi',
    defaultColumns: ['tenNgayNghi', 'tuNgay', 'denNgay', 'location', 'kichHoat'],
  },
  timestamps: true,
  access: {
    read: withBranchScopeOrGlobal(staffOnly, 'location'),
    create: canPlanSessions,
    update: canPlanSessions,
    delete: canPlanSessions,
  },
  hooks: {
    ...buildAuditHooks('holidays'),
    beforeValidate: [fillDenNgay],
  },
  fields: [
    {
      name: 'tenNgayNghi',
      type: 'text',
      label: 'Tên ngày nghỉ',
      required: true,
      admin: { description: 'VD: Tết Nguyên đán, Giỗ tổ Hùng Vương, Nghỉ 30/4–1/5.' },
    },
    {
      name: 'tuNgay',
      type: 'date',
      label: 'Từ ngày',
      required: true,
      admin: { date: DATE_ONLY, description: 'Ngày bắt đầu nghỉ (bao gồm).' },
    },
    {
      name: 'denNgay',
      type: 'date',
      label: 'Đến ngày',
      admin: {
        date: DATE_ONLY,
        description: 'Ngày kết thúc nghỉ (bao gồm). Để trống nếu nghỉ 1 ngày.',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      label: 'Cơ sở áp dụng',
      relationTo: 'locations',
      hasMany: true,
      admin: {
        description:
          'Để trống = nghỉ toàn công ty. Chọn 1 hoặc nhiều cơ sở = chỉ các cơ sở đó nghỉ.',
      },
    },
    {
      name: 'kichHoat',
      type: 'checkbox',
      label: 'Kích hoạt',
      defaultValue: true,
      admin: { description: 'Tắt để tạm ngưng áp dụng ngày nghỉ này khi sinh buổi.' },
    },
    {
      name: 'ghiChu',
      type: 'textarea',
      label: 'Ghi chú',
    },
  ],
}

export default Holidays
