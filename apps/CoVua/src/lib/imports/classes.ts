import type { Payload } from 'payload';
import type { ImportOptions } from './types';
import { parseHm, type DayOfWeek, type ScheduleSlot } from '@/lib/operations/schedule';

/**
 * Import idempotent danh sách LỚP HỌC vào collection `classes`.
 *
 * KHÓA ĐỊNH DANH: `title` (Tên lớp) — chống trùng. Chạy lại cùng file KHÔNG nhân
 * đôi: dòng đã có → update (chỉ cột có giá trị), chưa có → create.
 *
 * `level`/`ageGroup`/`location` BẮT BUỘC (schema) ⇒ thiếu/không khớp = error dòng.
 * GV/trợ giảng khớp theo `tenTat`; cơ sở khớp theo tên Locations. `lich_hoc` parse
 * gọn best-effort (slot lỗi → cảnh báo mềm, không chặn tạo lớp).
 *
 * KHÔNG `import 'server-only'` (dùng được cả Server Action lẫn `payload run`).
 * Quyền ghi đã kiểm ở lớp gọi; thao tác DB dùng `overrideAccess: true`.
 */

export type NormalizedRow = Record<string, string>;

export type ClassRowOutcome =
  | { row: number; status: 'created'; title: string; classId: number; warning?: string }
  | { row: number; status: 'updated'; title: string; classId: number; warning?: string }
  | { row: number; status: 'skipped'; title: string; message: string }
  | { row: number; status: 'error'; message: string; field?: string };

export type ClassImportResult = {
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  outcomes: ClassRowOutcome[];
};

/** Bỏ dấu tiếng Việt, lower-case, gộp ký tự → '_'. */
export function normalizeToken(input: string): string {
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

const LEVELS = new Set(['tot', 'ma', 'tuong', 'xe', 'hau', 'vua']);

const TRANG_THAI_ALIASES: Record<string, 'dang_mo' | 'tam_dung' | 'da_dong'> = {
  dang_mo: 'dang_mo',
  mo: 'dang_mo',
  active: 'dang_mo',
  tam_dung: 'tam_dung',
  tam_ngung: 'tam_dung',
  pause: 'tam_dung',
  da_dong: 'da_dong',
  dong: 'da_dong',
  closed: 'da_dong',
};

const DAY_TOKENS: Record<string, DayOfWeek> = {
  t2: 't2', thu_2: 't2', '2': 't2',
  t3: 't3', thu_3: 't3', '3': 't3',
  t4: 't4', thu_4: 't4', '4': 't4',
  t5: 't5', thu_5: 't5', '5': 't5',
  t6: 't6', thu_6: 't6', '6': 't6',
  t7: 't7', thu_7: 't7', '7': 't7',
  cn: 'cn', chu_nhat: 'cn',
};

/** Parse "T2 17:00-18:30 A1; T4 17:00-18:30" → slots (best-effort). */
export function parseLichHoc(raw: string): { slots: ScheduleSlot[]; warnings: string[] } {
  const slots: ScheduleSlot[] = [];
  const warnings: string[] = [];
  for (const partRaw of raw.split(';')) {
    const part = partRaw.trim();
    if (!part) continue;
    const m = /^(\S+)\s+(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\s*(.*)$/.exec(part);
    if (!m) {
      warnings.push(`Bỏ qua lịch "${part}" (định dạng cần: T2 17:00-18:30 [phòng]).`);
      continue;
    }
    const thu = DAY_TOKENS[normalizeToken(m[1])];
    const start = parseHm(m[2]);
    const end = parseHm(m[3]);
    if (!thu || start === null || end === null || end <= start) {
      warnings.push(`Bỏ qua lịch "${part}" (thứ/giờ không hợp lệ).`);
      continue;
    }
    const phong = m[4]?.trim();
    slots.push({ thu, gioBatDau: m[2], gioKetThuc: m[3], ...(phong ? { phong } : {}) });
  }
  return { slots, warnings };
}

export async function importClasses(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<ClassImportResult> {
  const dryRun = opts.dryRun ?? false;
  const result: ClassImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  };
  const record = (o: ClassRowOutcome) => {
    result.outcomes.push(o);
    if (o.status === 'created') result.created += 1;
    else if (o.status === 'updated') result.updated += 1;
    else if (o.status === 'skipped') result.skipped += 1;
    else result.errors += 1;
  };

  // Nạp Locations + Coaches một lần để khớp tên/tenTat.
  const locs = await payload.find({ collection: 'locations', limit: 500, overrideAccess: true, depth: 0 });
  const coaches = await payload.find({ collection: 'coaches', limit: 1000, overrideAccess: true, depth: 0 });
  const matchLocation = (name: string): number | null => {
    const t = normalizeToken(name);
    const exact = locs.docs.find((l) => normalizeToken(String(l.name ?? '')) === t);
    if (exact) return exact.id as number;
    const partial = locs.docs.find((l) => {
      const ln = normalizeToken(String(l.name ?? ''));
      return ln.includes(t) || t.includes(ln);
    });
    return partial ? (partial.id as number) : null;
  };
  const matchCoach = (tenTat: string): number | null => {
    const t = normalizeToken(tenTat);
    const c = coaches.docs.find((co) => normalizeToken(String(co.tenTat ?? '')) === t);
    return c ? (c.id as number) : null;
  };

  const seenInFile = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1;
    const row = rows[i];

    const title = pick(row, 'ten_lop', 'tenlop', 'ten_lop_hoc', 'ten', 'title');
    if (!title) {
      record({ row: rowNumber, status: 'error', message: 'Thiếu Tên lớp (ten_lop).', field: 'ten_lop' });
      continue;
    }
    const dedupeKey = normalizeToken(title);
    if (seenInFile.has(dedupeKey)) {
      record({ row: rowNumber, status: 'skipped', title, message: `Trùng Tên lớp "${title}" với dòng trước — bỏ qua.` });
      continue;
    }
    seenInFile.add(dedupeKey);

    // level (bắt buộc) — cho phép NHIỀU cấp (hasMany), ngăn cách bởi , ; / +.
    // Tuyến tự suy từ cấp qua hook `syncLevelTrack` của collection.
    const rawLevel = pick(row, 'cap_do', 'capdo', 'level', 'cap');
    if (!rawLevel) {
      record({ row: rowNumber, status: 'error', message: 'Thiếu Cấp độ (cap_do).', field: 'cap_do' });
      continue;
    }
    const levels: string[] = [];
    for (const piece of rawLevel.split(/[,;/+]/)) {
      const tok = normalizeToken(piece);
      if (tok && LEVELS.has(tok) && !levels.includes(tok)) levels.push(tok);
    }
    if (levels.length === 0) {
      record({ row: rowNumber, status: 'error', message: `Cấp độ "${rawLevel}" không hợp lệ. Dùng: Tốt | Mã | Tượng | Xe | Hậu | Vua (phẩy ngăn nhiều cấp).`, field: 'cap_do' });
      continue;
    }

    // ageGroup (bắt buộc)
    const rawAge = pick(row, 'nhom_tuoi', 'nhomtuoi', 'age_group', 'do_tuoi');
    if (!rawAge) {
      record({ row: rowNumber, status: 'error', message: 'Thiếu Nhóm tuổi (nhom_tuoi).', field: 'nhom_tuoi' });
      continue;
    }
    // Cho phép NHIỀU nhóm tuổi (hasMany): nhận cả 2 token, hoặc alias "Cả hai" / "Tất cả".
    const ageTok = normalizeToken(rawAge);
    const ageGroups: ('mam_non_4_6' | 'cap_1_cap_2')[] = [];
    if (ageTok.includes('mam')) ageGroups.push('mam_non_4_6');
    if (ageTok.includes('cap')) ageGroups.push('cap_1_cap_2');
    if (ageGroups.length === 0 && (ageTok.includes('hai') || ageTok.includes('tat_ca'))) {
      ageGroups.push('mam_non_4_6', 'cap_1_cap_2');
    }
    if (ageGroups.length === 0) {
      record({ row: rowNumber, status: 'error', message: `Nhóm tuổi "${rawAge}" không hợp lệ. Dùng: Mầm non | Cấp 1 - Cấp 2 | Cả hai.`, field: 'nhom_tuoi' });
      continue;
    }

    // location (bắt buộc)
    const rawLoc = pick(row, 'co_so', 'coso', 'location', 'chi_nhanh');
    if (!rawLoc) {
      record({ row: rowNumber, status: 'error', message: 'Thiếu Cơ sở (co_so).', field: 'co_so' });
      continue;
    }
    const locationId = matchLocation(rawLoc);
    if (!locationId) {
      record({ row: rowNumber, status: 'error', message: `Cơ sở "${rawLoc}" không khớp danh sách Locations.`, field: 'co_so' });
      continue;
    }

    // optional fields
    const warnings: string[] = [];
    const data: Record<string, unknown> = { title, level: levels, ageGroup: ageGroups, location: locationId };

    const rawGv = pick(row, 'gv', 'gv_phu_trach', 'coach', 'giao_vien');
    if (rawGv) {
      const cid = matchCoach(rawGv);
      if (cid) data.coach = cid;
      else warnings.push(`GV "${rawGv}" chưa khớp Tên tắt (bỏ trống GV).`);
    }
    const rawTg = pick(row, 'tro_giang', 'trogiang', 'assistant');
    if (rawTg) {
      const cid = matchCoach(rawTg);
      if (cid) data.troGiang = cid;
      else warnings.push(`Trợ giảng "${rawTg}" chưa khớp Tên tắt (bỏ trống).`);
    }
    const rawSiSo = pick(row, 'si_so_toi_da', 'siso', 'si_so', 'max');
    if (rawSiSo) {
      const n = Number(rawSiSo.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(n) && n > 0) data.siSoToiDa = n;
      else warnings.push(`Sĩ số "${rawSiSo}" không hợp lệ (bỏ qua).`);
    }
    const rawTrangThai = pick(row, 'trang_thai', 'trangthai', 'tinh_trang');
    if (rawTrangThai) {
      const t = TRANG_THAI_ALIASES[normalizeToken(rawTrangThai)];
      if (t) data.trangThai = t;
      else warnings.push(`Trạng thái "${rawTrangThai}" không hợp lệ (giữ mặc định).`);
    }
    const rawLich = pick(row, 'lich_hoc', 'lichhoc', 'lich', 'schedule');
    if (rawLich) {
      const { slots, warnings: w } = parseLichHoc(rawLich);
      warnings.push(...w);
      if (slots.length > 0) data.lichHoc = slots;
    }

    const warning = warnings.length > 0 ? warnings.join(' ') : undefined;

    try {
      const existing = await payload.find({
        collection: 'classes',
        where: { title: { equals: title } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });
      if (existing.totalDocs > 0) {
        const doc = existing.docs[0];
        if (!dryRun) {
          await payload.update({ collection: 'classes', id: doc.id, data, overrideAccess: true });
        }
        record({ row: rowNumber, status: 'updated', title, classId: doc.id as number, warning });
      } else if (dryRun) {
        record({ row: rowNumber, status: 'created', title, classId: 0, warning });
      } else {
        const created = await payload.create({ collection: 'classes', data: data as never, overrideAccess: true });
        record({ row: rowNumber, status: 'created', title, classId: created.id as number, warning });
      }
    } catch (err) {
      record({ row: rowNumber, status: 'error', message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.' });
    }
  }

  return result;
}
