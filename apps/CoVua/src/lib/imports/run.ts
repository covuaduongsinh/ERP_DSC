import 'server-only';
import type { Payload } from 'payload';
import type { ImportKind } from './kinds';
import type { ImportOptions, NormalizedRow } from './types';
import type { PreviewResult } from './preview-types';
import { importStudents } from './students';
import { importNhanXetBuoi } from './nhan-xet-buoi';
import { importProgressReports } from './progress-reports';
import { importCoaches } from './coaches';
import { importPayments } from './payments';
import { importClasses } from './classes';
import { importEnrollments } from './enrollments';

export type { PreviewResult, PreviewOutcome, PreviewStatus } from './preview-types';

/**
 * Lớp ĐIỀU PHỐI + CHUẨN HÓA cho luồng import /admin.
 *
 * Mỗi importer collection (đã viết ở SỬA 0–5) có kiểu kết quả riêng giàu thông
 * tin (vd Students có unmatchedLocations, NhanXet có coachLinkMissing…). Ở đây
 * ta gọi đúng importer theo `kind`, truyền `dryRun`, rồi MAP về một kiểu chung
 * `PreviewResult` để UI/Server Action xử lý đồng nhất 5 loại — KHÔNG đụng vào
 * logic khớp/idempotent gốc.
 */

const DASH = '—';

export async function runImport(
  payload: Payload,
  kind: ImportKind,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<PreviewResult> {
  switch (kind) {
    case 'students':
      return normalizeStudents(fileName, opts, await importStudents(payload, fileName, rows, opts));
    case 'attendance':
      return normalizeAttendance(fileName, opts, await importNhanXetBuoi(payload, fileName, rows, opts));
    case 'progress-reports':
      return normalizeProgressReports(fileName, opts, await importProgressReports(payload, fileName, rows, opts));
    case 'coaches':
      return normalizeCoaches(fileName, opts, await importCoaches(payload, fileName, rows, opts));
    case 'payments':
      return normalizePayments(fileName, opts, await importPayments(payload, fileName, rows, opts));
    case 'classes':
      return normalizeClasses(fileName, opts, await importClasses(payload, fileName, rows, opts));
    case 'enrollments':
      return normalizeEnrollments(fileName, opts, await importEnrollments(payload, fileName, rows, opts));
  }
}

function base(
  kind: ImportKind,
  fileName: string,
  opts: ImportOptions,
  r: { totalRows: number; created: number; updated: number; skipped: number; errors: number },
): PreviewResult {
  return {
    kind,
    fileName,
    dryRun: opts.dryRun ?? false,
    totalRows: r.totalRows,
    created: r.created,
    updated: r.updated,
    skipped: r.skipped,
    errors: r.errors,
    outcomes: [],
    notes: [],
  };
}

// ── Students ────────────────────────────────────────────────────────────
function normalizeStudents(
  fileName: string,
  opts: ImportOptions,
  r: import('./students').StudentImportResult,
): PreviewResult {
  const out = base('students', fileName, opts, r);
  for (const o of r.outcomes) {
    // Kiểm 'error'/'skipped' trước để TS thu hẹp gọn nhánh created|updated.
    if (o.status === 'error') {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.fullName, detail: o.message });
    } else {
      out.outcomes.push({
        row: o.row,
        status: o.status,
        label: o.fullName,
        detail: o.hasParent ? undefined : 'Chưa có phụ huynh ⇒ chưa onboarding được',
      });
    }
  }
  const imported = r.created + r.updated;
  out.notes.push(`${imported} học viên hợp lệ (tạo ${r.created} / cập nhật ${r.updated}).`);
  if (r.withoutParent > 0)
    out.notes.push(`${r.withoutParent} học viên chưa có phụ huynh ⇒ chưa onboarding được.`);
  if (r.parentsCreated > 0)
    out.notes.push(`${r.parentsCreated} phụ huynh ${out.dryRun ? 'sẽ được tạo' : 'tạo mới'}; ${r.parentsLinked} lượt nối phụ huynh.`);
  const unmatched = Object.entries(r.unmatchedLocations);
  if (unmatched.length > 0)
    out.notes.push(
      `Cơ sở không khớp Locations: ${unmatched.map(([name, n]) => `"${name}" (${n} dòng)`).join(', ')}.`,
    );
  return out;
}

// ── Attendance / Nhận xét buổi ──────────────────────────────────────────
function normalizeAttendance(
  fileName: string,
  opts: ImportOptions,
  r: import('./nhan-xet-buoi').NhanXetImportResult,
): PreviewResult {
  const out = base('attendance', fileName, opts, r);
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      out.outcomes.push({
        row: o.row,
        status: o.status,
        label: o.khoa,
        detail: o.coachLinked ? undefined : 'GV phụ trách chưa khớp Tên tắt',
      });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.khoa, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: o.khoa ?? DASH, detail: o.message, field: o.field });
    }
  }
  if (r.studentLinkMissing > 0)
    out.notes.push(`${r.studentLinkMissing} dòng không khớp học viên ⇒ không ghi được.`);
  if (r.coachLinkMissing > 0)
    out.notes.push(`${r.coachLinkMissing} bản ghi có GV nhưng chưa khớp Tên tắt (vẫn ghi, để trống GV).`);
  return out;
}

// ── Đánh giá định kỳ ────────────────────────────────────────────────────
function normalizeProgressReports(
  fileName: string,
  opts: ImportOptions,
  r: import('./types').ImportResult,
): PreviewResult {
  const out = base('progress-reports', fileName, opts, r);
  let coachUnlinked = 0;
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      const coachWarn = o.coachProvided && !o.coachLinked;
      if (coachWarn) coachUnlinked += 1;
      out.outcomes.push({
        row: o.row,
        status: o.status,
        label: o.label ?? o.key,
        detail: coachWarn ? 'GV phụ trách chưa khớp Tên tắt' : undefined,
      });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.label ?? o.key, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    }
  }
  if (coachUnlinked > 0)
    out.notes.push(`${coachUnlinked} báo cáo có GV nhưng chưa khớp Tên tắt (vẫn ghi, để trống GV).`);
  out.notes.push('Báo cáo nhập vào là NHÁP — phụ huynh chỉ thấy sau khi nhân viên điền Ngày phát hành.');
  return out;
}

// ── Giáo viên ───────────────────────────────────────────────────────────
function normalizeCoaches(
  fileName: string,
  opts: ImportOptions,
  r: import('./coaches').CoachImportResult,
): PreviewResult {
  const out = base('coaches', fileName, opts, r);
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      out.outcomes.push({ row: o.row, status: o.status, label: o.tenTat });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.tenTat, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    }
  }
  out.notes.push('Chỉ cập nhật cột CÓ giá trị trong file — ô trống không xóa dữ liệu đã nhập tay.');
  return out;
}

// ── Thanh toán ──────────────────────────────────────────────────────────
function normalizePayments(
  fileName: string,
  opts: ImportOptions,
  r: import('./payments').PaymentImportResult,
): PreviewResult {
  const out = base('payments', fileName, opts, r);
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      out.outcomes.push({ row: o.row, status: o.status, label: o.label });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.label, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    }
  }
  if (r.studentLinkMissing > 0)
    out.notes.push(`${r.studentLinkMissing} dòng không khớp học viên ⇒ không ghi được.`);
  return out;
}

// ── Lớp học ─────────────────────────────────────────────────────────────
function normalizeClasses(
  fileName: string,
  opts: ImportOptions,
  r: import('./classes').ClassImportResult,
): PreviewResult {
  const out = base('classes', fileName, opts, r);
  let withWarning = 0;
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      if (o.warning) withWarning += 1;
      out.outcomes.push({ row: o.row, status: o.status, label: o.title, detail: o.warning });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.title, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    }
  }
  out.notes.push('Chỉ cập nhật cột CÓ giá trị trong file — ô trống không xóa dữ liệu đã nhập tay.');
  if (withWarning > 0)
    out.notes.push(`${withWarning} lớp có cảnh báo mềm (GV/lịch chưa khớp) — vẫn ghi, xem cột chi tiết.`);
  return out;
}

// ── Ghi danh ────────────────────────────────────────────────────────────
function normalizeEnrollments(
  fileName: string,
  opts: ImportOptions,
  r: import('./enrollments').EnrollmentImportResult,
): PreviewResult {
  const out = base('enrollments', fileName, opts, r);
  for (const o of r.outcomes) {
    if (o.status === 'created' || o.status === 'updated') {
      out.outcomes.push({ row: o.row, status: o.status, label: o.label });
    } else if (o.status === 'skipped') {
      out.outcomes.push({ row: o.row, status: 'skipped', label: o.label, detail: o.message });
    } else {
      out.outcomes.push({ row: o.row, status: 'error', label: DASH, detail: o.message, field: o.field });
    }
  }
  out.notes.push('Học viên khớp theo tên (trùng tên cần SĐT phụ huynh); lớp phải đã tồn tại (nhập Lớp trước).');
  return out;
}
