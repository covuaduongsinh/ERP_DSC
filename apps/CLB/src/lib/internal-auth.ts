import { NextResponse, type NextRequest } from 'next/server'

/**
 * Xác thực service-token cho các API nội bộ /api/internal/* (server-to-server với CRM).
 * Trả NextResponse lỗi nếu không hợp lệ, hoặc `null` nếu hợp lệ (đi tiếp).
 */
export function assertInternalToken(req: NextRequest): NextResponse | null {
  const expected = process.env.INTERNAL_API_TOKEN
  if (!expected) {
    return NextResponse.json(
      { error: 'INTERNAL_API_TOKEN chưa cấu hình trên CLB.' },
      { status: 503 },
    )
  }
  if (req.headers.get('x-internal-token') !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
