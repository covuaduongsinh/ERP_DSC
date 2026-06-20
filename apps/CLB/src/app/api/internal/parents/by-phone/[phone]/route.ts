import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { assertInternalToken } from '@/lib/internal-auth'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/internal/parents/by-phone/:phone
 * Tra Phụ huynh theo SĐT (đã chuẩn hóa) để CRM khử trùng trước khi tạo handoff.
 * Trả `{ id, customerId? }` hoặc 404 nếu không có.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ phone: string }> },
): Promise<NextResponse> {
  const unauthorized = assertInternalToken(req)
  if (unauthorized) return unauthorized

  const { phone: raw } = await params
  const phone = normalizePhone(decodeURIComponent(raw ?? ''))
  if (!phone) return NextResponse.json({ error: 'Thiếu SĐT' }, { status: 400 })

  const payload = await getPayloadClient()
  const { docs } = await payload.find({
    collection: 'parents',
    where: { phone: { equals: phone } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (docs.length === 0) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const parent = docs[0] as { id: number | string; customerId?: string | null }
  return NextResponse.json({
    id: String(parent.id),
    customerId: parent.customerId ?? undefined,
  })
}
