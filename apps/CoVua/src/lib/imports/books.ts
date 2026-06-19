import type { Payload } from 'payload';
import type { ImportOptions } from './types';
import { normalizeName, normalizeExact, parseDateString } from './nhan-xet-buoi';
import { parseAmount } from './payments';

/**
 * Import idempotent SÁCH (`books`) + PHÁT SÁCH (`book-issues`) từ Lark CRM.
 *
 * - importBooks: khóa = `code` (Ký hiệu sách). Đã có → update, chưa có → create.
 * - importBookIssues: khớp HV theo tên (dedup giữ dấu, không đoán → student
 *   required), khớp sách theo `code`. Khóa chống trùng: `larkCode` (Ký hiệu lần
 *   phát) nếu có; nếu trống → (student|book|ngayDung). Không khớp HV → BÁO LỖI.
 *
 * KHÔNG `import 'server-only'` để chạy được ở script CLI. overrideAccess ở DB.
 */

type CoSo = 'kim_lien' | 'vinh_phuc';
function foldLoose(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
function mapCoSo(raw: string | undefined): CoSo | undefined {
  if (!raw) return undefined;
  const f = foldLoose(raw);
  if (f.includes('kim lien')) return 'kim_lien';
  if (f.includes('vinh phuc')) return 'vinh_phuc';
  return undefined;
}

// ---------------------------------------------------------------- Books

export type BookRow = {
  code: string;
  title: string;
  coverPrice?: string;
  salePrice?: string;
  levelSummary?: string;
};

export type BookImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  outcomes: Array<
    | { row: number; status: 'created' | 'updated'; code: string; bookId: number }
    | { row: number; status: 'skipped' | 'error'; code?: string; message: string }
  >;
};

export async function importBooks(
  payload: Payload,
  rows: BookRow[],
  opts: ImportOptions = {},
): Promise<BookImportResult> {
  const dryRun = opts.dryRun ?? false;
  const result: BookImportResult = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  };
  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const code = (row.code ?? '').trim();
    if (!code) {
      result.errors += 1;
      result.outcomes.push({ row: i + 1, status: 'error', message: 'Thiếu ký hiệu sách (code).' });
      continue;
    }
    if (seen.has(code)) {
      result.skipped += 1;
      result.outcomes.push({
        row: i + 1,
        status: 'skipped',
        code,
        message: `Trùng ký hiệu "${code}" với dòng trước trong file.`,
      });
      continue;
    }
    seen.add(code);

    const data: Record<string, unknown> = {
      code,
      title: (row.title ?? '').trim() || code, // fallback: ký hiệu nếu thiếu tên
    };
    const cover = parseAmount(row.coverPrice);
    const sale = parseAmount(row.salePrice);
    if (cover != null && cover !== undefined) data.coverPrice = cover;
    if (sale != null && sale !== undefined) data.salePrice = sale;
    if (row.levelSummary && row.levelSummary.trim()) data.levelSummary = row.levelSummary.trim();

    try {
      const existing = await payload.find({
        collection: 'books',
        where: { code: { equals: code } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      if (existing.totalDocs > 0) {
        const id = existing.docs[0].id as number;
        if (!dryRun) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await payload.update({ collection: 'books', id, data: data as any, overrideAccess: true });
        }
        result.updated += 1;
        result.outcomes.push({ row: i + 1, status: 'updated', code, bookId: id });
      } else {
        let id = 0;
        if (!dryRun) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = await payload.create({ collection: 'books', data: data as any, overrideAccess: true });
          id = c.id as number;
        }
        result.created += 1;
        result.outcomes.push({ row: i + 1, status: 'created', code, bookId: id });
      }
    } catch (err) {
      result.errors += 1;
      result.outcomes.push({
        row: i + 1,
        status: 'error',
        code,
        message: err instanceof Error ? err.message : 'Lỗi ghi DB.',
      });
    }
  }
  return result;
}

// ----------------------------------------------------------- Book issues

export type BookIssueRow = {
  studentName: string;
  bookCode?: string;
  ngayDung?: string;
  giaSach?: string;
  uuDai?: string;
  tienSach?: string;
  coSo?: string;
  larkCode?: string;
  ghiChu?: string;
};

export type BookIssueImportResult = {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  studentLinkMissing: number;
  bookLinkMissing: number;
  outcomes: Array<
    | { row: number; status: 'created' | 'updated'; key: string; studentId: number }
    | { row: number; status: 'skipped'; key: string; message: string }
    | { row: number; status: 'error'; message: string; linkMiss?: 'student' }
  >;
};

type Ref = { id: number; fullName: string };

export async function importBookIssues(
  payload: Payload,
  rows: BookIssueRow[],
  opts: ImportOptions = {},
): Promise<BookIssueImportResult> {
  const dryRun = opts.dryRun ?? false;
  const result: BookIssueImportResult = {
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    studentLinkMissing: 0,
    bookLinkMissing: 0,
    outcomes: [],
  };

  // Index Students theo tên
  const sRes = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  });
  const sIndex = new Map<string, Ref[]>();
  for (const s of sRes.docs) {
    const fullName = String((s as { fullName?: string }).fullName ?? '');
    const key = normalizeName(fullName);
    if (!key) continue;
    const arr = sIndex.get(key) ?? [];
    arr.push({ id: s.id as number, fullName });
    sIndex.set(key, arr);
  }
  function matchStudent(ten: string): { ok: true; id: number } | { ok: false; count: number } {
    const cand = sIndex.get(normalizeName(ten)) ?? [];
    if (cand.length === 1) return { ok: true, id: cand[0].id };
    if (cand.length === 0) return { ok: false, count: 0 };
    const want = normalizeExact(ten);
    const exact = cand.filter((c) => normalizeExact(c.fullName) === want);
    if (exact.length === 1) return { ok: true, id: exact[0].id };
    return { ok: false, count: cand.length };
  }

  // Index Books theo code
  const bRes = await payload.find({
    collection: 'books',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  });
  const bIndex = new Map<string, number>();
  for (const b of bRes.docs) {
    const code = String((b as { code?: string }).code ?? '').trim();
    if (code) bIndex.set(code, b.id as number);
  }

  const seen = new Set<string>();
  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const row = rows[i];

    const ten = (row.studentName ?? '').trim();
    if (!ten) {
      result.errors += 1;
      result.outcomes.push({ row: rowNumber, status: 'error', message: 'Thiếu tên học sinh.' });
      continue;
    }
    const m = matchStudent(ten);
    if (!m.ok) {
      result.studentLinkMissing += 1;
      result.errors += 1;
      result.outcomes.push({
        row: rowNumber,
        status: 'error',
        linkMiss: 'student',
        message:
          m.count === 0
            ? `Không khớp học viên "${ten}".`
            : `Có ${m.count} học viên trùng tên "${ten}" — cần xử lý tay.`,
      });
      continue;
    }
    const studentId = m.id;

    const bookCode = (row.bookCode ?? '').trim();
    let bookId: number | undefined;
    if (bookCode) {
      bookId = bIndex.get(bookCode);
      if (bookId === undefined) result.bookLinkMissing += 1;
    }

    const ngay = row.ngayDung ? parseDateString(String(row.ngayDung).slice(0, 10)) : null;

    // Khóa chống trùng: larkCode nếu có; nếu trống → student|book|ngay
    const larkCode = (row.larkCode ?? '').trim();
    const key = larkCode || `${studentId}|${bookId ?? ''}|${ngay ?? ''}`;
    if (seen.has(key)) {
      result.skipped += 1;
      result.outcomes.push({
        row: rowNumber,
        status: 'skipped',
        key,
        message: `Trùng khóa "${key}" với dòng trước trong file.`,
      });
      continue;
    }
    seen.add(key);

    const data: Record<string, unknown> = { student: studentId };
    if (bookId !== undefined) data.book = bookId;
    if (ngay) data.ngayDung = ngay;
    const gia = parseAmount(row.giaSach);
    const uu = parseAmount(row.uuDai);
    const tien = parseAmount(row.tienSach);
    if (gia != null && gia !== undefined) data.giaSach = gia;
    if (uu != null && uu !== undefined) data.uuDai = uu;
    if (tien != null && tien !== undefined) data.tienSach = tien;
    const coSo = mapCoSo(row.coSo);
    if (coSo) data.coSo = coSo;
    if (larkCode) data.larkCode = larkCode;
    if (row.ghiChu && row.ghiChu.trim()) data.ghiChu = row.ghiChu.trim();

    try {
      // Tìm bản ghi cũ theo khóa
      const where = larkCode
        ? { larkCode: { equals: larkCode } }
        : {
            and: [
              { student: { equals: studentId } },
              bookId !== undefined ? { book: { equals: bookId } } : { book: { exists: false } },
              ngay ? { ngayDung: { equals: ngay } } : { ngayDung: { exists: false } },
            ],
          };
      const existing = await payload.find({
        collection: 'book-issues',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: where as any,
        limit: 1,
        depth: 0,
        overrideAccess: true,
      });
      if (existing.totalDocs > 0) {
        if (!dryRun) {
          await payload.update({
            collection: 'book-issues',
            id: existing.docs[0].id,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            overrideAccess: true,
          });
        }
        result.updated += 1;
        result.outcomes.push({ row: rowNumber, status: 'updated', key, studentId });
      } else {
        if (!dryRun) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await payload.create({ collection: 'book-issues', data: data as any, overrideAccess: true });
        }
        result.created += 1;
        result.outcomes.push({ row: rowNumber, status: 'created', key, studentId });
      }
    } catch (err) {
      result.errors += 1;
      result.outcomes.push({
        row: rowNumber,
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi ghi DB.',
      });
    }
  }
  return result;
}
