import type { Payload } from 'payload';
import {
  emptyResult,
  recordOutcome,
  type ImportOptions,
  type ImportResult,
  type NormalizedRow,
} from './types';

/**
 * Import idempotent ĐÁNH GIÁ ĐỊNH KỲ vào collection `progress-reports` từ file
 * DanhGiaDinhKy_long.csv.
 *
 * KHÓA ĐỊNH DANH (chống trùng): `(student, period)`. Chạy lại cùng file KHÔNG
 * nhân đôi: khóa đã có → update, chưa có → create. Hai dòng cùng khóa trong
 * CÙNG file → dòng đầu là nguồn sự thật, dòng sau `skipped`.
 *
 * GẮN QUAN HỆ:
 * - student: khớp theo TÊN (`ten_hoc_vien`) — bỏ dấu, không phân biệt hoa/thường.
 *   Không khớp (0 hoặc >1 ứng viên) → KHÔNG ghi được (student bắt buộc).
 * - coach: khớp theo TÊN TẮT (`gv_phu_trach` ↔ `coaches.tenTat`). Không khớp →
 *   vẫn ghi báo cáo nhưng để coach trống (cảnh báo mềm `coachLinked=false`).
 *
 * Cột CSV đọc: ky, ten_hoc_vien, gv_phu_trach, y_thuc, btvn, tham_gia_giai_dau,
 * cac_sach_da_hoc, nhan_xet_chung, ke_hoach. (co_so / level / ghi_chu: bỏ qua —
 * `level` ở đây là tên tắt lớp, không phải cấp lộ trình của ProgressReports.)
 *
 * Module KHÔNG `import 'server-only'` để dùng được ở cả Server Action lẫn script
 * CLI (`payload run`). Quyền ghi đã kiểm ở lớp gọi; thao tác DB dùng overrideAccess.
 */

/** Các kỳ báo cáo hợp lệ — ĐỒNG BỘ với enum `period` của ProgressReports. */
export const PROGRESS_REPORT_PERIODS = [
  'Cuối năm 2024',
  '6 tháng đầu 2025',
  '6 tháng cuối 2025',
] as const;

export type ProgressReportPeriod = (typeof PROGRESS_REPORT_PERIODS)[number];

/** Bỏ dấu tiếng Việt, đ→d, lower-case, gộp khoảng trắng (giữ ranh giới từ). */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Bỏ dấu + mọi ký tự không phải [a-z0-9] → token gọn (cho tenTat). */
export function normalizeToken(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '');
}

function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k];
    if (v != null && v.trim() !== '') return v.trim();
  }
  return undefined;
}

/**
 * Chuẩn hóa kỳ về một giá trị enum hợp lệ (so khớp bỏ dấu/khoảng trắng).
 *
 * Dữ liệu thật ghi "6 tháng đầu/cuối NĂM 2025" — gắn alias về nhãn enum gọn
 * ('6 tháng đầu 2025' …). Lưu ý KHÔNG bỏ chữ "năm" toàn cục vì 'Cuối năm 2024'
 * cần giữ "năm".
 */
const PERIOD_ALIASES: Record<string, ProgressReportPeriod> = {
  'cuoi nam 2024': 'Cuối năm 2024',
  '6 thang dau 2025': '6 tháng đầu 2025',
  '6 thang dau nam 2025': '6 tháng đầu 2025',
  '6 thang cuoi 2025': '6 tháng cuối 2025',
  '6 thang cuoi nam 2025': '6 tháng cuối 2025',
};

export function normalizePeriod(raw: string): ProgressReportPeriod | null {
  return PERIOD_ALIASES[normalizeName(raw)] ?? null;
}

/**
 * Parse "Ý thức" → số trong [0..10]. Chấp "8", "8.5", "8,5". Ngoài khoảng hoặc
 * không phải số → null (bỏ qua field, KHÔNG báo lỗi dòng).
 */
export function parseYThuc(raw: string): number | null {
  const s = raw.replace(/^'/, '').trim().replace(',', '.');
  const m = /^(\d+(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
}

/**
 * Văn bản nhiều dòng (từ Excel) → lexical: mỗi dòng không rỗng thành 1 đoạn.
 * Giữ được cấu trúc "Ưu điểm / Nhược điểm" khi hiển thị ở cổng phụ huynh.
 */
export function multilineToLexical(text: string) {
  const paragraphs = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({
      type: 'paragraph',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: [
        {
          type: 'text',
          version: 1,
          text: line,
          format: 0,
          detail: 0,
          mode: 'normal',
          style: '',
        },
      ],
    }));

  const children =
    paragraphs.length > 0
      ? paragraphs
      : [
          {
            type: 'paragraph',
            version: 1,
            direction: 'ltr',
            format: '',
            indent: 0,
            children: [],
          },
        ];

  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr' as const,
      format: '' as const,
      indent: 0,
      children,
    },
  };
}

async function buildStudentIndex(
  payload: Payload,
): Promise<Map<string, number[]>> {
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  });
  const map = new Map<string, number[]>();
  for (const s of res.docs) {
    const key = normalizeName(String((s as { fullName?: string }).fullName ?? ''));
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(s.id as number);
    map.set(key, arr);
  }
  return map;
}

async function buildCoachIndex(payload: Payload): Promise<Map<string, number>> {
  const res = await payload.find({
    collection: 'coaches',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  });
  const map = new Map<string, number>();
  for (const c of res.docs) {
    const tenTat = (c as { tenTat?: string }).tenTat;
    if (!tenTat) continue;
    map.set(normalizeToken(tenTat), c.id as number);
  }
  return map;
}

/** Khớp GV theo tenTat từ ô gv_phu_trach (có thể chứa nhiều tên/ghi chú). */
function matchCoach(
  rawGv: string | undefined,
  coachByTenTat: Map<string, number>,
): { has: boolean; coachId: number | null } {
  if (!rawGv) return { has: false, coachId: null };
  // Tách theo , ; / hoặc xuống dòng (dữ liệu thật dùng "Tường; Quyên").
  const parts = rawGv
    .split(/[,;\n/]/)
    .map((p) => normalizeToken(p))
    .filter(Boolean);
  for (const p of parts) {
    const id = coachByTenTat.get(p);
    if (id != null) return { has: true, coachId: id };
  }
  return { has: true, coachId: null };
}

export async function importProgressReports(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<ImportResult> {
  const dryRun = opts.dryRun ?? false;
  const result = emptyResult(fileName);
  result.totalRows = rows.length;

  const studentIndex = await buildStudentIndex(payload);
  const coachIndex = await buildCoachIndex(payload);
  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1; // 1-based, không kể header
    const row = rows[i];

    // 1) Kỳ báo cáo (bắt buộc, phải thuộc enum)
    const rawPeriod = pick(row, 'ky', 'ky_bao_cao', 'period');
    if (!rawPeriod) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: 'Thiếu cột "ky" (kỳ báo cáo).',
        field: 'ky',
      });
      continue;
    }
    const period = normalizePeriod(rawPeriod);
    if (!period) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: `Kỳ "${rawPeriod}" không hợp lệ. Chỉ nhận: ${PROGRESS_REPORT_PERIODS.join(' | ')}.`,
        field: 'ky',
      });
      continue;
    }

    // 2) Khớp học viên theo tên (bắt buộc — student required)
    const tenHV = pick(row, 'ten_hoc_vien', 'ho_ten');
    if (!tenHV) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: 'Thiếu cột "ten_hoc_vien".',
        field: 'ten_hoc_vien',
      });
      continue;
    }
    const candidates = studentIndex.get(normalizeName(tenHV)) ?? [];
    if (candidates.length === 0) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: `Không khớp học viên tên "${tenHV}" (chưa có trong hệ thống).`,
        field: 'ten_hoc_vien',
      });
      continue;
    }
    if (candidates.length > 1) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: `Có ${candidates.length} học viên trùng tên "${tenHV}" — không xác định được dòng nào.`,
        field: 'ten_hoc_vien',
      });
      continue;
    }
    const studentId = candidates[0];

    // Khóa idempotent: student|period
    const key = `${studentId}|${period}`;
    const label = `${tenHV} — ${period}`;
    if (seenInFile.has(key)) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'skipped',
        key,
        label,
        message: `Trùng (học viên "${tenHV}" + kỳ "${period}") với dòng trước trong cùng file — bỏ qua.`,
      });
      continue;
    }
    seenInFile.add(key);

    // 3) Khớp GV theo tenTat (không khớp vẫn ghi, chỉ cảnh báo mềm)
    const coach = matchCoach(pick(row, 'gv_phu_trach', 'gv', 'coach'), coachIndex);
    const coachLinked = coach.coachId != null;

    // 4) Các field nội dung đánh giá
    const data: Record<string, unknown> = {
      student: studentId,
      period,
      btvn: pick(row, 'btvn') ?? null,
      thamGiaGiaiDau: pick(row, 'tham_gia_giai_dau', 'tham_gia_giai') ?? null,
      cacSachDaHoc: pick(row, 'cac_sach_da_hoc', 'sach_da_hoc') ?? null,
      keHoach: pick(row, 'ke_hoach') ?? null,
    };

    const rawY = pick(row, 'y_thuc');
    data.yThuc = rawY ? parseYThuc(rawY) : null;

    const nhanXet = pick(row, 'nhan_xet_chung', 'nhan_xet');
    data.nhanXetChung = nhanXet ? multilineToLexical(nhanXet) : null;

    // coach: chỉ set khi khớp tenTat (không ghi đè coach nhập tay bằng null).
    if (coachLinked) data.coach = coach.coachId;

    // 5) Idempotent upsert theo (student, period)
    try {
      const existing = await payload.find({
        collection: 'progress-reports',
        where: {
          and: [
            { student: { equals: studentId } },
            { period: { equals: period } },
          ],
        },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });

      // Cast: data field-set xây động theo dòng CSV. overrideAccess: true → bỏ
      // qua field access; runtime validation (required, min/max yThuc) vẫn chạy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writeData = data as any;
      if (existing.totalDocs > 0) {
        // dryRun: chỉ phân loại "sẽ cập nhật", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.update({
            collection: 'progress-reports',
            id: existing.docs[0].id,
            data: writeData,
            overrideAccess: true,
          });
        }
        recordOutcome(result, {
          row: rowNumber,
          status: 'updated',
          studentId,
          key,
          label,
          coachProvided: coach.has,
          coachLinked,
        });
      } else {
        // dryRun: chỉ phân loại "sẽ tạo mới", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.create({
            collection: 'progress-reports',
            data: writeData,
            overrideAccess: true,
          });
        }
        recordOutcome(result, {
          row: rowNumber,
          status: 'created',
          studentId,
          key,
          label,
          coachProvided: coach.has,
          coachLinked,
        });
      }
    } catch (err) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message:
          err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.',
      });
    }
  }

  return result;
}
