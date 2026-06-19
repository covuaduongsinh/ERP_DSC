import type { Payload } from 'payload';
import type { ImportOptions } from './types';
import { normalizeName, normalizeExact, parseDateString } from './nhan-xet-buoi';

/**
 * Import idempotent THANH TOÁN HỌC PHÍ vào collection `payments`.
 *
 * KHÓA ĐỊNH DANH (chống trùng): `(student, ngayNop, hocPhi)`. Chạy lại cùng file
 * KHÔNG nhân đôi: khóa đã có → update, chưa có → create. Hai dòng cùng khóa
 * trong CÙNG file → dòng đầu là nguồn sự thật, dòng sau `skipped`.
 *
 * KHỚP HỌC VIÊN theo TÊN (`ten_hoc_vien`): so khớp không phân biệt hoa/thường,
 * gỡ nhập nhằng bằng khớp CHÍNH XÁC giữ dấu khi nhiều ứng viên. KHÔNG fuzzy-match
 * tên rút gọn — không khớp (0 hoặc >1) → BÁO LỖI để nhân viên xử lý tay (không
 * đoán, vì thanh toán là dữ liệu tiền bạc, gán nhầm rất nguy hiểm).
 *
 * Module KHÔNG `import 'server-only'` để dùng được ở cả Server Action lẫn script
 * CLI. Quyền ghi đã kiểm ở lớp gọi; thao tác DB dùng overrideAccess.
 */

export type NormalizedRow = Record<string, string>;

export type PaymentRowOutcome =
  | { row: number; status: 'created'; key: string; label: string; studentId: number }
  | { row: number; status: 'updated'; key: string; label: string; studentId: number }
  | { row: number; status: 'skipped'; key: string; label: string; message: string }
  | {
      row: number;
      status: 'error';
      message: string;
      field?: string;
      /** Dòng không khớp được học viên (báo cáo tách bạch). */
      linkMiss?: 'student';
    };

export type PaymentImportResult = {
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  /** Số dòng không khớp được học viên (không ghi được). */
  studentLinkMissing: number;
  outcomes: PaymentRowOutcome[];
};

type CoSo = 'kim_lien' | 'vinh_phuc';
type TinhTrang = 'da_nop' | 'cho';

/** Bỏ dấu + ký tự không phải [a-z0-9] → '_' (cho alias enum). */
function token(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v.trim() !== '') return v.trim();
  }
  return undefined;
}

const CO_SO_ALIASES: Record<string, CoSo> = {
  kim_lien: 'kim_lien',
  kl: 'kim_lien',
  vinh_phuc: 'vinh_phuc',
  vp: 'vinh_phuc',
};

const TINH_TRANG_ALIASES: Record<string, TinhTrang> = {
  da_nop: 'da_nop',
  danop: 'da_nop',
  paid: 'da_nop',
  cho: 'cho',
  cho_nop: 'cho',
  chua_nop: 'cho',
  pending: 'cho',
};

/**
 * Parse số tiền VND. Bỏ dấu phân cách hàng nghìn ("1.500.000", "1,500,000",
 * "1 500 000") → số nguyên. Trống → undefined; không phải số → null (lỗi).
 */
export function parseAmount(raw: string | undefined): number | null | undefined {
  if (raw == null || raw.trim() === '') return undefined;
  const cleaned = raw.replace(/[^\d-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type StudentRef = { id: number; fullName: string };

async function buildStudentIndex(
  payload: Payload,
): Promise<Map<string, StudentRef[]>> {
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  });
  const map = new Map<string, StudentRef[]>();
  for (const s of res.docs) {
    const fullName = String((s as { fullName?: string }).fullName ?? '');
    const key = normalizeName(fullName);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push({ id: s.id as number, fullName });
    map.set(key, arr);
  }
  return map;
}

/**
 * Khớp 1 tên trong CSV với roster:
 *  - 1 ứng viên (không-dấu) → chốt.
 *  - nhiều ứng viên → thử khớp CHÍNH XÁC giữ dấu; đúng 1 → chốt, còn lại → mơ hồ.
 *  - 0 ứng viên → không khớp.
 */
function matchStudent(
  ten: string,
  index: Map<string, StudentRef[]>,
): { ok: true; id: number } | { ok: false; count: number } {
  const cand = index.get(normalizeName(ten)) ?? [];
  if (cand.length === 1) return { ok: true, id: cand[0].id };
  if (cand.length === 0) return { ok: false, count: 0 };
  const want = normalizeExact(ten);
  const exact = cand.filter((c) => normalizeExact(c.fullName) === want);
  if (exact.length === 1) return { ok: true, id: exact[0].id };
  return { ok: false, count: cand.length };
}

export async function importPayments(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<PaymentImportResult> {
  const dryRun = opts.dryRun ?? false;
  const result: PaymentImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    studentLinkMissing: 0,
    outcomes: [],
  };

  const record = (o: PaymentRowOutcome) => {
    result.outcomes.push(o);
    if (o.status === 'created') result.created += 1;
    else if (o.status === 'updated') result.updated += 1;
    else if (o.status === 'skipped') result.skipped += 1;
    else result.errors += 1;
  };

  const studentIndex = await buildStudentIndex(payload);
  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1; // 1-based, không kể header
    const row = rows[i];

    // 1) Khớp học viên theo tên (bắt buộc — student required)
    const tenHV = pick(row, 'ten_hoc_vien', 'ho_ten', 'hoc_vien');
    if (!tenHV) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu cột "ten_hoc_vien".',
        field: 'ten_hoc_vien',
      });
      continue;
    }
    const matched = matchStudent(tenHV, studentIndex);
    if (!matched.ok) {
      result.studentLinkMissing += 1;
      record({
        row: rowNumber,
        status: 'error',
        linkMiss: 'student',
        message:
          matched.count === 0
            ? `Không khớp học viên tên "${tenHV}" (chưa có trong hệ thống).`
            : `Có ${matched.count} học viên trùng tên "${tenHV}" — không xác định được. Cần xử lý tay.`,
        field: 'ten_hoc_vien',
      });
      continue;
    }
    const studentId = matched.id;

    // 2) Ngày nộp (bắt buộc — thành phần khóa)
    const rawNgay = pick(row, 'ngay_nop', 'ngay', 'date');
    const ngayNop = rawNgay ? parseDateString(rawNgay) : null;
    if (!ngayNop) {
      record({
        row: rowNumber,
        status: 'error',
        message: `Ngày nộp "${rawNgay ?? ''}" trống/không hợp lệ (cần YYYY-MM-DD hoặc DD/MM/YYYY).`,
        field: 'ngay_nop',
      });
      continue;
    }

    // 3) Học phí (thành phần khóa)
    const rawHocPhi = pick(row, 'hoc_phi', 'hocphi');
    const hocPhi = parseAmount(rawHocPhi);
    if (hocPhi === null) {
      record({
        row: rowNumber,
        status: 'error',
        message: `Học phí "${rawHocPhi}" không phải số hợp lệ.`,
        field: 'hoc_phi',
      });
      continue;
    }

    // Khóa idempotent: student|ngayNop|hocPhi
    const hocPhiKey = hocPhi == null ? '' : String(hocPhi);
    const key = `${studentId}|${ngayNop}|${hocPhiKey}`;
    const label = `${tenHV} — ${ngayNop}${hocPhi != null ? ` — ${hocPhi.toLocaleString('vi-VN')}đ` : ''}`;
    if (seenInFile.has(key)) {
      record({
        row: rowNumber,
        status: 'skipped',
        key,
        label,
        message: `Trùng (học viên "${tenHV}" + ngày ${ngayNop} + học phí ${hocPhiKey || '—'}) với dòng trước trong cùng file — bỏ qua.`,
      });
      continue;
    }
    seenInFile.add(key);

    // 4) Các field còn lại
    const rawCoSo = pick(row, 'co_so', 'coso');
    let coSo: CoSo | undefined;
    if (rawCoSo) {
      coSo = CO_SO_ALIASES[token(rawCoSo)];
      if (!coSo) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Cơ sở "${rawCoSo}" không hợp lệ. Dùng: Kim Liên | Vĩnh Phúc.`,
          field: 'co_so',
        });
        continue;
      }
    }

    const rawTinhTrang = pick(row, 'tinh_trang', 'tinhtrang', 'trang_thai');
    let tinhTrang: TinhTrang | undefined;
    if (rawTinhTrang) {
      tinhTrang = TINH_TRANG_ALIASES[token(rawTinhTrang)];
      if (!tinhTrang) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Tình trạng "${rawTinhTrang}" không hợp lệ. Dùng: Đã nộp | Chờ.`,
          field: 'tinh_trang',
        });
        continue;
      }
    }

    const tienSach = parseAmount(pick(row, 'tien_sach', 'tiensach'));
    const muaKhac = parseAmount(pick(row, 'mua_khac', 'muakhac'));
    const hp1Buoi = parseAmount(pick(row, 'hp1_buoi', 'hp_1_buoi', 'hp1buoi'));
    const soBuoiNop = parseAmount(pick(row, 'so_buoi_nop', 'sobuoinop', 'so_buoi'));
    for (const [val, col] of [
      [tienSach, 'tien_sach'],
      [muaKhac, 'mua_khac'],
      [hp1Buoi, 'hp1_buoi'],
      [soBuoiNop, 'so_buoi_nop'],
    ] as const) {
      if (val === null) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Giá trị cột "${col}" không phải số hợp lệ.`,
          field: col,
        });
      }
    }
    if (tienSach === null || muaKhac === null || hp1Buoi === null || soBuoiNop === null) {
      continue;
    }

    const ghiChu = pick(row, 'ghi_chu', 'note', 'ghichu');

    // Chỉ set field có giá trị (tránh ghi đè dữ liệu nhập tay bằng null khi update).
    const data: Record<string, unknown> = {
      student: studentId,
      ngayNop,
    };
    if (hocPhi !== undefined) data.hocPhi = hocPhi;
    if (tienSach !== undefined) data.tienSach = tienSach;
    if (muaKhac !== undefined) data.muaKhac = muaKhac;
    if (hp1Buoi !== undefined) data.hp1Buoi = hp1Buoi;
    if (soBuoiNop !== undefined) data.soBuoiNop = soBuoiNop;
    if (coSo !== undefined) data.coSo = coSo;
    if (tinhTrang !== undefined) data.tinhTrang = tinhTrang;
    if (ghiChu !== undefined) data.ghiChu = ghiChu;

    // 5) Idempotent upsert theo (student, ngayNop, hocPhi)
    try {
      const and: Record<string, unknown>[] = [
        { student: { equals: studentId } },
        { ngayNop: { equals: ngayNop } },
      ];
      and.push(hocPhi == null ? { hocPhi: { exists: false } } : { hocPhi: { equals: hocPhi } });
      const existing = await payload.find({
        collection: 'payments',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        where: { and } as any,
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writeData = data as any;
      if (existing.totalDocs > 0) {
        const doc = existing.docs[0];
        if (!dryRun) {
          await payload.update({
            collection: 'payments',
            id: doc.id,
            data: writeData,
            overrideAccess: true,
          });
        }
        record({ row: rowNumber, status: 'updated', key, label, studentId });
      } else {
        if (!dryRun) {
          await payload.create({
            collection: 'payments',
            data: writeData,
            overrideAccess: true,
          });
        }
        record({ row: rowNumber, status: 'created', key, label, studentId });
      }
    } catch (err) {
      record({
        row: rowNumber,
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.',
      });
    }
  }

  return result;
}
