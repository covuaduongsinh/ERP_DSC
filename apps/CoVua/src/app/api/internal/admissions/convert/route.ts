import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { upsertParentStudentEnrollment, type AdmissionUpsertInput } from '@/lib/leads/admission'
import { assertInternalToken } from '@/lib/internal-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/internal/admissions/convert
 *
 * Handoff CRM → CoVua: khi một Deal "Tuyển sinh" được chốt ở CRM, CRM gọi endpoint
 * này (server-to-server) để tạo Phụ huynh + Học viên + Ghi danh trong CoVua.
 *
 * Xác thực bằng SERVICE TOKEN (header `x-internal-token` khớp INTERNAL_API_TOKEN),
 * KHÔNG dùng phiên đăng nhập user. Idempotent nhờ chống trùng SĐT/tên trong core.
 */
interface ConvertBody {
  customerId?: string
  parent?: { fullName?: string; phone?: string; email?: string | null; zaloId?: string | null }
  student?: {
    fullName?: string
    dob?: string | null
    levelId?: string | null
    locationId?: string | null
  }
  classId?: string | null
  sourceDealId?: string
  startDate?: string | null
}

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const unauthorized = assertInternalToken(req)
  if (unauthorized) return unauthorized

  let body: ConvertBody
  try {
    body = (await req.json()) as ConvertBody
  } catch {
    return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 })
  }

  const fullName = body.parent?.fullName?.trim()
  const phone = body.parent?.phone?.trim()
  if (!fullName || !phone) {
    return NextResponse.json({ error: 'Thiếu họ tên hoặc SĐT phụ huynh' }, { status: 400 })
  }

  const input: AdmissionUpsertInput = {
    parentFullName: fullName,
    phone,
    email: body.parent?.email ?? null,
    zaloId: body.parent?.zaloId ?? null,
    studentFullName: body.student?.fullName?.trim() || undefined,
    locationId: toNum(body.student?.locationId),
    classId: toNum(body.classId),
    startDate: body.startDate ?? null,
    crmDealId: body.sourceDealId ?? null,
  }

  const payload = await getPayloadClient()
  const result = await upsertParentStudentEnrollment(payload, input)

  if (!result.ok) {
    const status = result.error === 'invalid_phone' ? 400 : 500
    return NextResponse.json({ error: result.message }, { status })
  }

  return NextResponse.json({
    parentId: String(result.parentId),
    studentId: String(result.studentId),
    enrollmentId: result.enrollmentId != null ? String(result.enrollmentId) : null,
    reused: result.reusedParent,
  })
}
