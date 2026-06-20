import { NextResponse, type NextRequest } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import type { Class } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import { buildClassDuplicateData } from '@/lib/classes/duplicate'

/**
 * POST /api/admin-duplicate/classes
 *
 * Nhân bản 1+ lớp sẵn có thành lớp mới (tên thêm "(bản sao)", copy đầy đủ cấu
 * hình). CHỈ nhân viên đăng nhập /admin (đường /api ngoài middleware portal →
 * bảo vệ bằng Payload auth tại đây). Dùng Local API `overrideAccess: false` +
 * user thật ⇒ tôn trọng access control: `create` lớp = admin/manager/
 * receptionist, chạy hook syncLevelTrack + ghi audit log như tạo lớp thường.
 *
 * KHÔNG copy ghi danh / buổi học (collection riêng).
 *
 * Body JSON: { ids: Array<number|string> }  →  { created: Array<{ id, title }> }
 */
export async function POST(request: NextRequest) {
  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })

  // Chỉ nhân viên (users), không phải phụ huynh hay khách.
  if (!user || user.collection !== 'users') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { ids?: Array<number | string> }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const ids = Array.isArray(body.ids) ? body.ids : []
  if (ids.length === 0) {
    return NextResponse.json({ error: 'Chưa chọn lớp để tạo bản sao.' }, { status: 400 })
  }

  const created: Array<{ id: number | string; title: string }> = []
  try {
    for (const id of ids) {
      const source = (await payload.findByID({
        collection: 'classes',
        id,
        depth: 0, // quan hệ trả id thô để copy thẳng
        overrideAccess: false,
        user,
      })) as Class

      const copy = await payload.create({
        collection: 'classes',
        data: buildClassDuplicateData(source),
        overrideAccess: false,
        user,
      })
      created.push({ id: copy.id, title: copy.title })
    }
  } catch (err) {
    payload.logger.error({ err }, 'admin-duplicate classes failed')
    const message =
      err instanceof Error && /forbidden|unauthorized/i.test(err.message)
        ? 'Bạn không có quyền tạo lớp.'
        : 'Không tạo được bản sao lớp.'
    // Nếu đã tạo được một phần, trả về phần đã tạo kèm cảnh báo (207).
    return NextResponse.json(
      { error: message, created },
      { status: created.length > 0 ? 207 : 500 },
    )
  }

  return NextResponse.json({ created }, { status: 200 })
}
