import { NextResponse, type NextRequest } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { mergeListSearchAndWhere } from 'payload/shared'
import type { Sort, Where } from 'payload'
import { getPayloadClient } from '@/lib/payload'
import { buildRows, EXPORT_COLLECTIONS, isExportableCollection } from '@/lib/exports/columns'
import {
  EXPORT_CONTENT_TYPE,
  exportFileName,
  toCsv,
  toXlsx,
  type ExportFormat,
} from '@/lib/exports/serialize'

/**
 * POST /api/admin-export/[collection]
 *
 * Xuất CSV/Excel cho một collection theo ĐÚNG bộ lọc đang hiển thị trên list
 * view (where + search + sort gửi từ client `useListQuery`). CHỈ nhân viên đăng
 * nhập /admin xuất được (đường /api ngoài middleware portal → bảo vệ bằng
 * Payload auth tại đây). Truy vấn dùng `overrideAccess: false` + user thật để
 * tôn trọng access control của collection (không leak dữ liệu phụ huynh).
 *
 * Body JSON: { format: 'csv' | 'xlsx', where?, sort?, search? }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ collection: string }> },
) {
  const { collection } = await context.params
  if (!isExportableCollection(collection)) {
    return NextResponse.json({ error: 'Không hỗ trợ xuất collection này.' }, { status: 404 })
  }

  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })

  // Chỉ nhân viên (users), không phải phụ huynh hay khách.
  if (!user || user.collection !== 'users') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { format?: string; where?: Where; sort?: Sort; search?: string }
  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const format: ExportFormat = body.format === 'xlsx' ? 'xlsx' : 'csv'

  // Gộp ô tìm kiếm vào where giống hệt list view server-side, để tập kết quả
  // khớp đúng những gì nhân viên đang nhìn thấy.
  const collectionConfig = payload.collections[collection]?.config
  const where =
    collectionConfig && body.search
      ? mergeListSearchAndWhere({
          collectionConfig,
          search: body.search,
          where: body.where ?? {},
        })
      : body.where

  let docs: Array<Record<string, unknown>>
  try {
    const result = await payload.find({
      collection,
      where,
      sort: body.sort,
      depth: 1, // populate quan hệ để lấy tên (học viên, GV, cơ sở…)
      pagination: false, // xuất toàn bộ tập đang lọc, không chỉ trang hiện tại
      overrideAccess: false,
      user,
    })
    docs = result.docs as unknown as Array<Record<string, unknown>>
  } catch (err) {
    payload.logger.error({ err }, 'admin-export find failed')
    return NextResponse.json({ error: 'Không truy vấn được dữ liệu để xuất.' }, { status: 500 })
  }

  const { headers, rows } = buildRows(collection, docs)
  const { fileBase, sheetName } = EXPORT_COLLECTIONS[collection]
  const fileName = exportFileName(fileBase, format)

  const payloadBody: string | Buffer =
    format === 'xlsx' ? toXlsx(headers, rows, sheetName) : toCsv(headers, rows)

  return new NextResponse(payloadBody as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': EXPORT_CONTENT_TYPE[format],
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
