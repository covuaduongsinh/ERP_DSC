/**
 * Script import THANH TOÁN từ Lark Base — bảng "Tổng Deal (HP + book)".
 *
 * Nguồn: .lark-import/tongdeal.json + hocvien.json (xuất bằng .lark-import/export.py).
 * Đích : collection `payments` (tái dùng importPayments — idempotent theo
 *        (student, ngayNop, hocPhi)).
 *
 * Chạy (DRY-RUN mặc định, KHÔNG ghi DB):
 *   pnpm --filter @ds/web payload run scripts/import-payments-lark.ts
 * Ghi thật vào DB (payload run nuốt flag `--`, dùng positional `commit` hoặc COMMIT=1):
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/import-payments-lark.ts commit
 *
 * KHỚP HỌC VIÊN: ưu tiên tên đã resolve từ link "Tên HS link" → HocVien.Học viên;
 * nếu deal KHÔNG có link thì dùng text "ID Tổng Deal" làm dự phòng. Không khớp
 * (0/>1 học viên) → importPayments BÁO LỖI để soát tay (không đoán — đây là tiền).
 *
 * BỎ QUA cột "Tình trạng" của Lark ("Đã hết" = hết buổi, KHÔNG phải trạng thái
 * thanh toán) → payments.tinhTrang dùng mặc định 'da_nop' (sổ tiền đã thu).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { importPayments, type NormalizedRow } from '../src/lib/imports/payments';

type DealRecord = {
  record_id: string;
  hs_text: string | null;
  hs_link: string[] | null;
  ngay_nop: string | null;
  hoc_phi: number | string | null;
  tien_sach: number | string | null;
  mua_khac: number | string | null;
  hp1_buoi: number | string | null;
  so_buoi_nop: number | string | null;
  co_so: string[] | string | null;
  tinh_trang: string[] | string | null;
  ghi_chu: string | null;
};
type HocVienRecord = { record_id: string; name: string | null };

const DIR = path.resolve(process.cwd(), '..', '..', '.lark-import');

function readJson<T>(file: string): T {
  const p = path.join(DIR, file);
  if (!fs.existsSync(p)) {
    console.error(`✗ Không tìm thấy ${p}. Chạy: python .lark-import/export.py`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
}

function s(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.length ? String(v[0]) : '';
  return String(v);
}

async function main() {
  // `payload run` nuốt flag dạng `--commit`; nhận thêm positional `commit` + env.
  const commit =
    process.argv.includes('--commit') ||
    process.argv.includes('commit') ||
    process.env.COMMIT === '1';
  const deals = readJson<DealRecord[]>('tongdeal.json');
  const hocvien = readJson<HocVienRecord[]>('hocvien.json');
  const hvMap = new Map<string, string>();
  for (const h of hocvien) hvMap.set(h.record_id, (h.name ?? '').trim());

  let viaLink = 0;
  let viaText = 0;
  let noName = 0;
  const rows: NormalizedRow[] = deals.map((d) => {
    // Tên học viên: link → tên HocVien; nếu không có link → text "ID Tổng Deal".
    let ten = '';
    if (d.hs_link && d.hs_link.length) {
      ten = (hvMap.get(d.hs_link[0]) ?? '').trim();
      if (ten) viaLink += 1;
    }
    if (!ten && d.hs_text) {
      ten = d.hs_text.trim();
      if (ten) viaText += 1;
    }
    if (!ten) noName += 1;
    const ngay = s(d.ngay_nop).slice(0, 10); // "2024-01-05 00:00:00" → "2024-01-05"
    return {
      ten_hoc_vien: ten,
      ngay_nop: ngay,
      hoc_phi: s(d.hoc_phi),
      tien_sach: s(d.tien_sach),
      mua_khac: s(d.mua_khac),
      hp1_buoi: s(d.hp1_buoi),
      so_buoi_nop: s(d.so_buoi_nop),
      co_so: s(d.co_so),
      ghi_chu: s(d.ghi_chu),
      // CỐ Ý không map tinh_trang (xem doc đầu file) → mặc định 'da_nop'.
    };
  });

  console.error(
    `[import-payments-lark] ${rows.length} deal | tên qua link: ${viaLink} | qua text: ${viaText} | không có tên: ${noName} | chế độ: ${commit ? 'GHI THẬT' : 'DRY-RUN'}`,
  );

  const payload = await getPayload({ config: await config });
  const result = await importPayments(payload, 'Tổng Deal (HP + book) — Lark', rows, {
    dryRun: !commit,
  });

  const reviews = result.outcomes.filter(
    (o) => o.status === 'error' || o.status === 'skipped',
  );
  const linkMiss = result.outcomes.filter(
    (o) => o.status === 'error' && 'linkMiss' in o && o.linkMiss === 'student',
  );

  const lines: string[] = [];
  lines.push(`\n=== Import Thanh toán: ${result.fileName} (${commit ? 'GHI THẬT' : 'DRY-RUN'}) ===`);
  lines.push(`Tổng dòng              : ${result.totalRows}`);
  lines.push(`  ✅ ${commit ? 'Tạo mới' : 'SẼ tạo'}           : ${result.created}`);
  lines.push(`  ♻️  ${commit ? 'Cập nhật' : 'SẼ cập nhật'}      : ${result.updated}`);
  lines.push(`  ⏭️  Bỏ qua (trùng file): ${result.skipped}`);
  lines.push(`  ❌ Lỗi                : ${result.errors}`);
  lines.push(`     ↳ không khớp HV    : ${result.studentLinkMissing}`);

  if (linkMiss.length > 0) {
    lines.push(`\n--- Deal KHÔNG khớp được học viên (${linkMiss.length}) — soát tay ---`);
    for (const o of linkMiss) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`);
    }
  }
  const otherErr = reviews.filter(
    (o) => !(o.status === 'error' && 'linkMiss' in o && o.linkMiss === 'student'),
  );
  if (otherErr.length > 0) {
    lines.push(`\n--- Dòng khác cần soát (${otherErr.length}) ---`);
    for (const o of otherErr) {
      if (o.status === 'error') {
        lines.push(`  [dòng ${o.row}] LỖI${o.field ? ` (${o.field})` : ''}: ${o.message}`);
      } else if (o.status === 'skipped') {
        lines.push(`  [dòng ${o.row}] BỎ QUA: ${o.message}`);
      }
    }
  }

  process.stderr.write(lines.join('\n') + '\n');
  process.exitCode = 0;
}

try {
  await main();
} catch (err) {
  console.error('✗ Import thất bại:', err);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
