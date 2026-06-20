import { NextResponse, type NextRequest } from 'next/server'
import { getPayloadClient } from '@/lib/payload'
import { resolveTuitionCycleStatus } from '@/lib/tuition'

/**
 * GET /api/cron/reconcile-tuition  — JOB ĐỊNH KỲ (Vercel Cron).
 *
 * Tự cập nhật `tuition-cycles.status` theo dữ liệu thật (số buổi đã học + ngày
 * hết hạn) ⇒ gói tự chuyển `dang_hoc → sap_het → da_het` mà KHÔNG cần sửa tay.
 * Đây là phần "nhắc tái tục": gói chuyển `sap_het` sẽ nổi lên hàng đợi
 * `lowTuitionCycles` (staff-queues) và cảnh báo ở cổng phụ huynh.
 *
 * BẢO MẬT: endpoint ghi dữ liệu ⇒ bắt buộc CRON_SECRET. Vercel Cron tự gắn
 * `Authorization: Bearer ${CRON_SECRET}` khi env CRON_SECRET được đặt. Thiếu env
 * ⇒ 503 (không mở endpoint trần). Sai/không có header ⇒ 401.
 *
 * Idempotent: `resolveTuitionCycleStatus` tất định theo dữ liệu ⇒ chạy lại nhiều
 * lần cho cùng kết quả; chỉ ghi khi status thực sự đổi. CHỈ xét gói còn hiệu lực
 * (`dang_hoc | sap_het`) — không đụng `da_het` (đơn điệu, tránh đảo ngược bất ngờ).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET chưa cấu hình — từ chối để không mở endpoint ghi.' },
      { status: 503 },
    )
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await getPayloadClient()
  const now = new Date()

  const { docs } = await payload.find({
    collection: 'tuition-cycles',
    where: { status: { in: ['dang_hoc', 'sap_het'] } },
    overrideAccess: true,
    depth: 0,
    pagination: false,
    limit: 0,
  })

  let scanned = 0
  let updated = 0
  const transitions: Record<string, number> = {}

  for (const cycle of docs) {
    scanned += 1
    const next = resolveTuitionCycleStatus(cycle, now)
    if (next === cycle.status) continue
    try {
      await payload.update({
        collection: 'tuition-cycles',
        id: cycle.id,
        data: { status: next },
        overrideAccess: true,
      })
      updated += 1
      const key = `${cycle.status}→${next}`
      transitions[key] = (transitions[key] ?? 0) + 1
    } catch (err) {
      payload.logger.error({ err, cycleId: cycle.id }, 'reconcile-tuition update failed')
    }
  }

  return NextResponse.json({ ok: true, scanned, updated, transitions, at: now.toISOString() })
}
