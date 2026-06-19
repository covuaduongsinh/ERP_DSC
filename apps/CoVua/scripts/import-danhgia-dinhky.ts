/**
 * Script import ĐÁNH GIÁ ĐỊNH KỲ từ CSV vào collection `progress-reports`.
 *
 * Chạy:
 *   pnpm --filter web payload run scripts/import-danhgia-dinhky.ts <duong-dan.csv>
 *   (mặc định: ../../DanhGiaDinhKy_long.csv ở gốc repo)
 *
 * Idempotent theo khóa (student, period): chạy lại KHÔNG nhân đôi. In báo cáo
 * created / updated / skipped (trùng khóa trong file) / error, kèm số dòng LỆCH
 * LINK học viên (không ghi được) và bản ghi LỆCH LINK HLV (đã ghi, coach trống).
 */
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { parseCsvText } from '../src/lib/spreadsheet-preview';
import {
  importProgressReports,
} from '../src/lib/imports/progress-reports';
import type { NormalizedRow } from '../src/lib/imports/types';

/** Chuẩn hóa header → snake_case (khớp key mà processor mong đợi). */
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
  const arg = process.argv[2];
  const csvPath = path.resolve(
    process.cwd(),
    arg ?? path.join('..', '..', 'DanhGiaDinhKy_long.csv'),
  );
  console.error('[import-danhgia-dinhky] file:', csvPath);

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

  console.error(`[import-danhgia-dinhky] đọc ${rows.length} dòng dữ liệu.`);
  const payload = await getPayload({ config: await config });
  const result = await importProgressReports(payload, path.basename(csvPath), rows);

  const gvUnmatched = result.outcomes.filter(
    (o) =>
      (o.status === 'created' || o.status === 'updated') &&
      o.coachProvided === true &&
      o.coachLinked === false,
  );
  const gvEmpty = result.outcomes.filter(
    (o) =>
      (o.status === 'created' || o.status === 'updated') &&
      o.coachProvided === false,
  );
  const studentMiss = result.outcomes.filter(
    (o) => o.status === 'error' && o.field === 'ten_hoc_vien',
  );
  const periodErr = result.outcomes.filter(
    (o) => o.status === 'error' && o.field === 'ky',
  );
  const otherErr = result.outcomes.filter(
    (o) => o.status === 'error' && o.field !== 'ten_hoc_vien' && o.field !== 'ky',
  );

  const lines: string[] = [];
  lines.push(`\n=== Import Đánh giá định kỳ: ${result.fileName} ===`);
  lines.push(`Tổng dòng dữ liệu       : ${result.totalRows}`);
  lines.push(`  ✅ Tạo mới             : ${result.created}`);
  lines.push(`  ♻️  Cập nhật            : ${result.updated}`);
  lines.push(`  ⏭️  Bỏ qua (trùng khóa) : ${result.skipped}`);
  lines.push(`  ❌ Lỗi                 : ${result.errors}`);
  lines.push(`  → SỐ BẢN GHI VÀO       : ${result.created + result.updated}`);
  lines.push(`  ⚠ Lệch link học viên   : ${studentMiss.length} (không ghi được)`);
  lines.push(`  ⚠ GV ghi nhưng ≠ tenTat: ${gvUnmatched.length} (đã ghi, coach trống)`);
  lines.push(`  · GV để trống trong file: ${gvEmpty.length} (đã ghi, không có HLV để gắn)`);

  if (studentMiss.length > 0) {
    lines.push(
      `\n--- Dòng LỆCH LINK HỌC VIÊN (hiện ${Math.min(60, studentMiss.length)}/${studentMiss.length}) ---`,
    );
    for (const o of studentMiss.slice(0, 60)) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`);
    }
  }

  if (periodErr.length > 0) {
    lines.push(`\n--- Dòng SAI KỲ BÁO CÁO (${periodErr.length}) ---`);
    for (const o of periodErr.slice(0, 30)) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`);
    }
  }

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
// Payload giữ pool DB mở → buộc thoát sau khi đã flush báo cáo.
process.exit(process.exitCode ?? 0);
