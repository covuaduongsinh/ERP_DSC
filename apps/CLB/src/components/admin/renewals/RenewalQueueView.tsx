import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import type { Parent, Student, TuitionCycle } from '@/payload-types'
import { canProcessRenewals } from '@/access'
import { PROCESSABLE_RENEWAL_STATUSES } from '@/lib/renewals/process'
import { RenewalQueueClient, type RenewalRow } from './RenewalQueueClient'

/** Trần số dòng nạp ra trang (hàng đợi chờ thực tế chỉ vài chục). */
const QUEUE_LIMIT = 500

/**
 * Hàng đợi DUYỆT yêu cầu gia hạn (admin view — staff tool).
 *
 * Server-side liệt kê yêu cầu đang CHỜ (`moi | dang_xu_ly`) bằng Local API với
 * `user` = nhân viên đăng nhập + `overrideAccess: false` ⇒ access control của
 * collection vẫn là hàng rào. Chỉ kế toán/quản lý/admin được THAO TÁC (core +
 * collection `update` gate role); role khác vẫn xem được danh sách nhưng nút
 * duyệt/từ chối sẽ trả 'forbidden'. Để tránh nhầm lẫn, ta ẩn luôn công cụ thao
 * tác với role không đủ quyền và hiện thông báo.
 */
export async function RenewalQueueView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req,
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    )
  }

  const canProcess = canProcessRenewals({ req }) === true

  const { docs, totalDocs } = await payload.find({
    collection: 'renewal-requests',
    where: { status: { in: PROCESSABLE_RENEWAL_STATUSES } },
    user,
    overrideAccess: false,
    depth: 1, // populate student + parent + tuitionCycle để hiển thị tên/gói
    limit: QUEUE_LIMIT,
    sort: 'createdAt', // cũ nhất trước (FIFO) — chờ lâu xử lý trước
  })

  const initialRequests: RenewalRow[] = docs.map((reqDoc) => {
    const student = reqDoc.student as Student | number | null
    const parent = reqDoc.parent as Parent | number | null
    const cycle = reqDoc.tuitionCycle as TuitionCycle | number | null
    return {
      id: reqDoc.id,
      studentName: student && typeof student === 'object' ? student.fullName : 'Học viên',
      parentName: parent && typeof parent === 'object' ? parent.fullName : null,
      parentPhone: parent && typeof parent === 'object' ? parent.phone : null,
      currentPackage: cycle && typeof cycle === 'object' ? cycle.package : null,
      sessionsRemaining: reqDoc.sessionsRemaining,
      parentNote: reqDoc.parentNote ?? null,
      status: reqDoc.status,
      createdAt: reqDoc.createdAt,
    }
  })

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
        <header style={{ marginBottom: 16 }}>
          <h1>Duyệt yêu cầu gia hạn</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Phụ huynh gửi yêu cầu gia hạn từ cổng. Duyệt để chốt gói mới (sinh chu kỳ học phí) hoặc
            từ chối kèm lý do.
          </p>
        </header>
        {canProcess ? (
          <RenewalQueueClient
            initialRequests={initialRequests}
            truncated={totalDocs > docs.length}
          />
        ) : (
          <p role="alert" style={{ color: 'var(--theme-warning-600)', fontWeight: 600 }}>
            Chỉ kế toán, quản lý hoặc admin mới được duyệt/từ chối yêu cầu gia hạn. Bạn đang xem ở
            chế độ chỉ đọc ({initialRequests.length} yêu cầu đang chờ).
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
