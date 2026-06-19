/**
 * Script import SÁCH + PHÁT SÁCH từ Lark Base — bảng "Sách" + "Từng lần phát sách".
 *
 * Nguồn: .lark-import/{sach,phatsach,hocvien}.json (xuất bằng export.py).
 * Đích : collection `books` (catalog) + `book-issues` (sổ phát sách).
 *
 * Chạy (DRY-RUN mặc định):
 *   pnpm --filter @ds/web payload run scripts/import-books-lark.ts
 * Ghi thật:
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/import-books-lark.ts commit
 *
 * Books trước (để book-issues khớp được sách theo code). Phát sách: HS resolve
 * qua link → HocVien.Học viên → khớp Students; sách resolve qua link → Sách.code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import {
  importBooks,
  importBookIssues,
  type BookRow,
  type BookIssueRow,
} from '../src/lib/imports/books';

type SachRecord = {
  record_id: string;
  title: string | null;
  gia_bia: number | string | null;
  gia_ban: number | string | null;
  trinh_do: string | null;
  ky_hieu: string | null;
};
type PhatSachRecord = {
  record_id: string;
  sach_dung: string[] | null;
  hoc_sinh: string[] | null;
  ngay_dung: string | null;
  tien_sach: number | string | null;
  gia: string[] | string | null;
  uu_dai: number | string | null;
  co_so: string[] | string | null;
  ghi_chu: string | null;
  ky_hieu: string | null;
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
  const commit =
    process.argv.includes('--commit') ||
    process.argv.includes('commit') ||
    process.env.COMMIT === '1';

  const sach = readJson<SachRecord[]>('sach.json');
  const phatsach = readJson<PhatSachRecord[]>('phatsach.json');
  const hocvien = readJson<HocVienRecord[]>('hocvien.json');

  const hvMap = new Map<string, string>();
  for (const h of hocvien) hvMap.set(h.record_id, (h.name ?? '').trim());
  // record_id sách → code (ky_hieu); fallback title nếu thiếu code
  const bookCodeByRec = new Map<string, string>();
  for (const b of sach) {
    bookCodeByRec.set(b.record_id, (b.ky_hieu ?? '').trim() || (b.title ?? '').trim());
  }

  const bookRows: BookRow[] = sach.map((b) => ({
    code: (b.ky_hieu ?? '').trim(),
    title: (b.title ?? '').trim(),
    coverPrice: s(b.gia_bia),
    salePrice: s(b.gia_ban),
    levelSummary: (b.trinh_do ?? '').trim(),
  }));

  let noHs = 0;
  const issueRows: BookIssueRow[] = phatsach.map((r) => {
    const hsName = r.hoc_sinh && r.hoc_sinh.length ? hvMap.get(r.hoc_sinh[0]) ?? '' : '';
    if (!hsName) noHs += 1;
    const bookCode = r.sach_dung && r.sach_dung.length ? bookCodeByRec.get(r.sach_dung[0]) ?? '' : '';
    return {
      studentName: hsName,
      bookCode,
      ngayDung: s(r.ngay_dung).slice(0, 10),
      giaSach: s(r.gia), // "₫30,000" → parseAmount lấy số
      uuDai: s(r.uu_dai),
      tienSach: s(r.tien_sach),
      coSo: s(r.co_so),
      larkCode: (r.ky_hieu ?? '').trim(),
      ghiChu: (r.ghi_chu ?? '').trim(),
    };
  });

  console.error(
    `[import-books-lark] sách: ${bookRows.length} | phát sách: ${issueRows.length} (thiếu HS: ${noHs}) | chế độ: ${commit ? 'GHI THẬT' : 'DRY-RUN'}`,
  );

  const payload = await getPayload({ config: await config });

  const bRes = await importBooks(payload, bookRows, { dryRun: !commit });
  const iRes = await importBookIssues(payload, issueRows, { dryRun: !commit });

  const lines: string[] = [];
  lines.push(`\n=== Import SÁCH (books) [${commit ? 'GHI THẬT' : 'DRY-RUN'}] ===`);
  lines.push(`  Tổng: ${bRes.totalRows} | ${commit ? 'tạo' : 'sẽ tạo'}: ${bRes.created} | cập nhật: ${bRes.updated} | bỏ qua: ${bRes.skipped} | lỗi: ${bRes.errors}`);

  lines.push(`\n=== Import PHÁT SÁCH (book-issues) [${commit ? 'GHI THẬT' : 'DRY-RUN'}] ===`);
  lines.push(`  Tổng: ${iRes.totalRows}`);
  lines.push(`  ✅ ${commit ? 'tạo' : 'sẽ tạo'}: ${iRes.created} | cập nhật: ${iRes.updated} | bỏ qua(trùng): ${iRes.skipped} | lỗi: ${iRes.errors}`);
  lines.push(`     ↳ không khớp HV: ${iRes.studentLinkMissing} | sách không khớp code: ${iRes.bookLinkMissing}`);

  const issueErrs = iRes.outcomes.filter((o) => o.status === 'error');
  if (issueErrs.length) {
    lines.push(`\n--- Phát sách lỗi (${issueErrs.length}) — soát tay ---`);
    for (const o of issueErrs) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`);
    }
  }
  const bookErrs = bRes.outcomes.filter((o) => o.status === 'error' || o.status === 'skipped');
  if (bookErrs.length) {
    lines.push(`\n--- Sách cần soát (${bookErrs.length}) ---`);
    for (const o of bookErrs) {
      if (o.status === 'error' || o.status === 'skipped') lines.push(`  [dòng ${o.row}] ${o.message}`);
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
