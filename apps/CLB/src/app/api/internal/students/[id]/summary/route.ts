import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { assertInternalToken } from '@/lib/internal-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Nhãn hiển thị cho quan hệ đã populate (thử các field tên phổ biến), fallback id. */
function label(rel: unknown): string | null {
  if (rel == null) return null
  if (typeof rel === 'object') {
    const o = rel as Record<string, unknown>
    for (const k of ['ten', 'name', 'title', 'label', 'tenCap']) {
      if (typeof o[k] === 'string' && o[k]) return o[k] as string
    }
    return o.id != null ? String(o.id) : null
  }
  return String(rel)
}

/**
 * GET /api/internal/students/:id/summary
 * Bản tóm tắt học viên cho view 360° trên Contact phụ huynh bên CRM: cấp/cơ sở,
 * trạng thái, số buổi tồn, lớp đang học, vài phiếu thu gần nhất.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = assertInternalToken(req)
  if (unauthorized) return unauthorized

  const { id } = await params
  const payload = await getPayloadClient()

  let student: Record<string, unknown> | null = null
  try {
    student = (await payload.findByID({
      collection: 'students',
      id,
      depth: 1,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const [{ docs: enrollments }, { docs: payments }] = await Promise.all([
    payload.find({
      collection: 'enrollments',
      where: { and: [{ student: { equals: id } }, { dangHoc: { equals: true } }] },
      depth: 1,
      limit: 20,
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payments',
      where: { student: { equals: id } },
      sort: '-ngayNop',
      depth: 0,
      limit: 5,
      overrideAccess: true,
    }),
  ])

  return NextResponse.json({
    id: String(student.id),
    fullName: student.fullName ?? null,
    nickname: student.nickname ?? null,
    level: label(student.capChinh),
    location: label(student.location),
    enrollmentStatus: student.enrollmentStatus ?? null,
    sessionBalance: student.soBuoiTonDauKy ?? null,
    activeClasses: enrollments.map((e) => {
      const c = (e as unknown as Record<string, unknown>).class as unknown
      return { id: label(c), title: typeof c === 'object' ? label(c) : null }
    }),
    recentPayments: payments.map((p) => {
      const d = p as unknown as Record<string, unknown>
      const total = (Number(d.hocPhi) || 0) + (Number(d.tienSach) || 0) + (Number(d.muaKhac) || 0)
      return {
        id: String(d.id),
        date: d.ngayNop ?? null,
        total,
        sessions: d.soBuoiNop ?? null,
        status: d.tinhTrang ?? null,
      }
    }),
  })
}
