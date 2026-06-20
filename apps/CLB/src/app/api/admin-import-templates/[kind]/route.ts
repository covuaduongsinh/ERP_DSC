import { NextResponse, type NextRequest } from 'next/server'
import { headers as nextHeaders } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { IMPORT_KIND_META, isImportKind, templateToCsv } from '@/lib/imports/kinds'

/**
 * GET /api/admin-import-templates/[kind]
 *
 * Trả file CSV mẫu cho nhân viên điền (5 loại: students | attendance |
 * progress-reports | coaches | payments). CHỈ staff đăng nhập /admin mới tải
 * được — chống lộ cấu trúc cột ra ngoài. Đường dẫn ngoài middleware portal
 * (matcher bỏ /api), nên bảo vệ tại đây bằng Payload auth.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  const { kind } = await context.params
  if (!isImportKind(kind)) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 404 })
  }

  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })

  if (!user || user.collection !== 'users') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tpl = IMPORT_KIND_META[kind].template
  const csv = templateToCsv(kind)

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${tpl.fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
