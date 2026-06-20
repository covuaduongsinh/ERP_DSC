/**
 * Smoke-test dry-run cho luồng Import CSV (chạy đọc-thuần trên DB thật).
 *
 * Mục tiêu:
 *  1. Importer payments (MỚI) phân loại đúng created/error theo dòng.
 *  2. dryRun KHÔNG ghi gì: số bản ghi trước == sau cho payments & students.
 *
 * Chạy: pnpm --filter @ds/web payload run scripts/test-import-dryrun.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { importPayments } from '../src/lib/imports/payments'
import { importStudents } from '../src/lib/imports/students'
import type { NormalizedRow } from '../src/lib/imports/types'

const REAL_STUDENT = 'Nguyễn Doãn Long'
const out: string[] = []
function log(s: string) {
  out.push(s)
}

async function main() {
  const payload = await getPayload({ config: await config })

  const countBefore = async (collection: 'payments' | 'students' | 'parents') =>
    (await payload.count({ collection, overrideAccess: true })).totalDocs

  const payBefore = await countBefore('payments')
  const stuBefore = await countBefore('students')
  const parBefore = await countBefore('parents')

  // ── Payments dry-run ──────────────────────────────────────────────────
  const payRows: NormalizedRow[] = [
    {
      ten_hoc_vien: REAL_STUDENT,
      ngay_nop: '2030-01-15',
      hoc_phi: '1.000.000',
      co_so: 'Kim Liên',
      tinh_trang: 'Đã nộp',
    },
    { ten_hoc_vien: 'Không Tồn Tại Xyz 999', ngay_nop: '2030-01-15', hoc_phi: '500000' },
    { ten_hoc_vien: REAL_STUDENT, ngay_nop: 'ngay-sai', hoc_phi: '500000' },
    { ten_hoc_vien: REAL_STUDENT, ngay_nop: '2030-01-16', hoc_phi: 'không-phải-số' },
    { ten_hoc_vien: REAL_STUDENT, ngay_nop: '2030-01-15', hoc_phi: '1.000.000' }, // trùng dòng 1 trong file
  ]
  const payRes = await importPayments(payload, 'test-payments.csv', payRows, { dryRun: true })
  log('=== Payments dry-run ===')
  log(
    `  created=${payRes.created} updated=${payRes.updated} skipped=${payRes.skipped} errors=${payRes.errors} studentLinkMissing=${payRes.studentLinkMissing}`,
  )
  for (const o of payRes.outcomes) {
    if (o.status === 'error') log(`  [dòng ${o.row}] LỖI (${o.field ?? ''}): ${o.message}`)
    else if (o.status === 'skipped') log(`  [dòng ${o.row}] BỎ QUA: ${o.message}`)
    else log(`  [dòng ${o.row}] ${o.status.toUpperCase()}: ${o.label}`)
  }

  // ── Students dry-run ──────────────────────────────────────────────────
  const stuRows: NormalizedRow[] = [
    { ho_ten: REAL_STUDENT }, // đã có → sẽ cập nhật
    { ho_ten: 'Tên Mới Kiểm Thử Zzz 999' }, // mới → sẽ tạo
    { ho_ten: '' }, // lỗi thiếu tên
  ]
  const stuRes = await importStudents(payload, 'test-students.csv', stuRows, { dryRun: true })
  log('=== Students dry-run ===')
  log(
    `  created=${stuRes.created} updated=${stuRes.updated} skipped=${stuRes.skipped} errors=${stuRes.errors}`,
  )
  for (const o of stuRes.outcomes) {
    if (o.status === 'error') log(`  [dòng ${o.row}] LỖI: ${o.message}`)
    else if (o.status === 'skipped') log(`  [dòng ${o.row}] BỎ QUA: ${o.message}`)
    else
      log(`  [dòng ${o.row}] ${o.status.toUpperCase()}: ${o.fullName} (hasParent=${o.hasParent})`)
  }

  // ── Khẳng định KHÔNG ghi ──────────────────────────────────────────────
  const payAfter = await countBefore('payments')
  const stuAfter = await countBefore('students')
  const parAfter = await countBefore('parents')
  log('=== Khẳng định không ghi (dryRun) ===')
  log(`  payments: ${payBefore} -> ${payAfter} ${payBefore === payAfter ? 'OK' : 'SAI!!!'}`)
  log(`  students: ${stuBefore} -> ${stuAfter} ${stuBefore === stuAfter ? 'OK' : 'SAI!!!'}`)
  log(`  parents : ${parBefore} -> ${parAfter} ${parBefore === parAfter ? 'OK' : 'SAI!!!'}`)

  const noWrite = payBefore === payAfter && stuBefore === stuAfter && parBefore === parAfter
  // Kỳ vọng: payments có 1 created + 3 error (student/date/amount) + 1 skipped (trùng); students 1 updated + 1 created + 1 error.
  const payOk = payRes.created === 1 && payRes.errors === 3 && payRes.skipped === 1
  const stuOk = stuRes.updated === 1 && stuRes.created === 1 && stuRes.errors === 1
  log('=== Kết luận ===')
  log(`  payments phân loại đúng: ${payOk ? 'OK' : 'SAI'}`)
  log(`  students phân loại đúng: ${stuOk ? 'OK' : 'SAI'}`)
  log(`  dryRun không ghi: ${noWrite ? 'OK' : 'SAI'}`)

  process.exitCode = noWrite && payOk && stuOk ? 0 : 2
}

try {
  await main()
} catch (err) {
  log('✗ Lỗi: ' + (err instanceof Error ? (err.stack ?? err.message) : String(err)))
  process.exitCode = 1
}
process.stderr.write('\n' + out.join('\n') + '\n')
process.exit(process.exitCode ?? 0)
