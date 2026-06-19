/**
 * Script import NHẬN XÉT BUỔI HỌC từ CSV vào collection `attendance`.
 *
 * Chạy:
 *   # Dry-run (KHÔNG ghi) — kiểm chứng trước:
 *   pnpm --filter @ds/web payload run scripts/import-nhanxet-buoi.ts
 *   # Ghi THẬT vào DB:
 *   pnpm --filter @ds/web payload run scripts/import-nhanxet-buoi.ts commit
 *   # CSV khác mặc định (gốc repo: ../../NhanXetBuoi_long.csv):
 *   pnpm --filter @ds/web payload run scripts/import-nhanxet-buoi.ts commit duong-dan.csv
 *
 * Idempotent theo cột `khoa` = co_so|buoi|ten_hoc_vien: chạy lại KHÔNG nhân đôi.
 * In báo cáo created / updated / skipped (trùng khóa trong file) / error, kèm
 * SỐ BẢN GHI VÀO và SỐ DÒNG LỆCH LINK (student / coach) theo dòng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { parseCsvText } from '../src/lib/spreadsheet-preview';
import {
  importNhanXetBuoi,
  type NormalizedRow,
} from '../src/lib/imports/nhan-xet-buoi';

/** Chuẩn hóa header → snake_case (khop key mà processor mong đợi). */
function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('commit');
  const pathArg = args.find((a) => a !== 'commit');
  const csvPath = path.resolve(
    process.cwd(),
    pathArg ?? path.join('..', '..', 'NhanXetBuoi_long.csv'),
  );
  console.error('[import-nhanxet-buoi] file:', csvPath);
  console.error(
    `[import-nhanxet-buoi] chế độ: ${commit ? 'COMMIT (ghi thật)' : 'DRY-RUN (không ghi)'}`,
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`✗ Không tìm thấy file CSV: ${csvPath}`);
    process.exit(1);
  }

  const text = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '');
  const matrix = parseCsvText(text).filter((r) => r.some((c) => c.trim() !== ''));
  if (matrix.length < 2) {
    console.error('✗ File không có dòng dữ liệu sau dòng tiêu đề.');
    process.exit(1);
  }

  const [headerRow, ...dataRows] = matrix;
  const headers = headerRow.map((h) => normalizeHeader(h));
  const rows: NormalizedRow[] = dataRows.map((raw) => {
    const obj: NormalizedRow = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = (raw[idx] ?? '').trim();
    });
    return obj;
  });

  console.error(`[import-nhanxet-buoi] đọc ${rows.length} dòng dữ liệu.`);
  const payload = await getPayload({ config: await config });
  const result = await importNhanXetBuoi(payload, path.basename(csvPath), rows, {
    dryRun: !commit,
  });

  const lines: string[] = [];
  lines.push(`\n=== Import Nhận xét buổi: ${result.fileName} ===`);
  lines.push(`Chế độ               : ${commit ? 'COMMIT (đã ghi DB)' : 'DRY-RUN (chưa ghi DB)'}`);
  lines.push(`Tổng dòng dữ liệu    : ${result.totalRows}`);
  lines.push(`  ✅ Tạo mới          : ${result.created}`);
  lines.push(`  ♻️  Cập nhật         : ${result.updated}`);
  lines.push(`  ⏭️  Bỏ qua (trùng)   : ${result.skipped}`);
  lines.push(`  ❌ Lỗi              : ${result.errors}`);
  lines.push(`  → SỐ BẢN GHI VÀO    : ${result.created + result.updated}`);
  lines.push(`  ⚠ Lệch link student : ${result.studentLinkMissing} (không ghi được)`);
  lines.push(`  ⚠ Lệch link coach   : ${result.coachLinkMissing} (đã ghi, coach trống)`);

  // Liệt kê tối đa 40 dòng lệch link student để nhân viên đối chiếu.
  const studentMiss = result.outcomes.filter(
    (o) => o.status === 'error' && o.linkMiss === 'student',
  );
  if (studentMiss.length > 0) {
    lines.push(`\n--- Dòng lệch link HỌC VIÊN (hiện ${Math.min(40, studentMiss.length)}/${studentMiss.length}) ---`);
    for (const o of studentMiss.slice(0, 40)) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`);
    }
  }

  const coachMiss = result.outcomes.filter(
    (o) => (o.status === 'created' || o.status === 'updated') && !o.coachLinked,
  );
  if (coachMiss.length > 0) {
    lines.push(`\n--- Bản ghi GHI ĐƯỢC nhưng LỆCH LINK COACH (hiện ${Math.min(20, coachMiss.length)}/${coachMiss.length}) ---`);
    for (const o of coachMiss.slice(0, 20)) {
      if (o.status === 'created' || o.status === 'updated') {
        lines.push(`  [dòng ${o.row}] khóa "${o.khoa}"`);
      }
    }
  }

  const otherErr = result.outcomes.filter(
    (o) => o.status === 'error' && o.linkMiss !== 'student',
  );
  if (otherErr.length > 0) {
    lines.push(`\n--- Lỗi khác (${otherErr.length}) ---`);
    for (const o of otherErr.slice(0, 30)) {
      if (o.status === 'error') {
        const field = o.field ? ` (cột ${o.field})` : '';
        lines.push(`  [dòng ${o.row}] LỖI${field}: ${o.message}`);
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
