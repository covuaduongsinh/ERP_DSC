import 'server-only';
import type { Payload } from 'payload';
import { parseDateString, pick } from './parse';
import { lookupStudent } from './student-lookup';
import {
  emptyResult,
  recordOutcome,
  type ImportResult,
  type NormalizedRow,
} from './types';

/**
 * Map cột → trạng thái điểm danh trong DB.
 * Chấp nhận cả "có mặt" / "comat" / "co_mat" / "present" v.v. để dễ chịu
 * khi nhân viên copy từ LARK.
 */
const STATUS_ALIASES: Record<string, 'co_mat' | 'vang' | 'phep'> = {
  co_mat: 'co_mat',
  comat: 'co_mat',
  cm: 'co_mat',
  present: 'co_mat',
  có_mặt: 'co_mat',
  vang: 'vang',
  v: 'vang',
  absent: 'vang',
  vắng: 'vang',
  phep: 'phep',
  p: 'phep',
  excused: 'phep',
  phép: 'phep',
};

function normalizeStatusKey(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
}

/**
 * Idempotent upsert điểm danh:
 * - Khóa định danh: (student, date).
 * - Trùng → update (cập nhật status/note); không trùng → create.
 * - Trong cùng file, nếu hai dòng cùng (student, date), dòng sau ghi đè dòng trước.
 */
export async function importAttendance(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
): Promise<ImportResult> {
  const result = emptyResult(fileName);
  result.totalRows = rows.length;

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1; // 1-based, không kể header
    const row = rows[i];

    // 1) Tìm học viên
    const lookup = await lookupStudent({
      payload,
      studentCode: pick(row, 'ma_hoc_vien', 'student_id', 'id'),
      fullName: pick(row, 'ho_ten', 'fullname', 'ten_hoc_vien'),
      parentPhone: pick(row, 'sdt_phu_huynh', 'phone', 'sdt'),
    });
    if (!lookup.ok) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: lookup.error,
        field: lookup.field,
      });
      continue;
    }

    // 2) Validate ngày
    const rawDate = pick(row, 'ngay', 'date', 'ngay_hoc');
    if (!rawDate) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: 'Thiếu cột ngay (ngày học).',
        field: 'ngay',
      });
      continue;
    }
    const date = parseDateString(rawDate);
    if (!date) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: `Ngày "${rawDate}" không hợp lệ (chấp nhận YYYY-MM-DD hoặc DD/MM/YYYY).`,
        field: 'ngay',
      });
      continue;
    }

    // 3) Validate status
    const rawStatus = pick(row, 'trang_thai', 'status') ?? '';
    const statusKey = normalizeStatusKey(rawStatus);
    const status = STATUS_ALIASES[statusKey];
    if (!status) {
      recordOutcome(result, {
        row: rowNumber,
        status: 'error',
        message: `Trạng thái "${rawStatus}" không hợp lệ. Dùng co_mat | vang | phep.`,
        field: 'trang_thai',
      });
      continue;
    }

    const note = pick(row, 'ghi_chu', 'note') ?? undefined;

    // 4) Idempotent upsert: tìm bản ghi cùng (student, date)
    try {
      const existing = await payload.find({
        collection: 'attendance',
        where: {
          and: [
            { student: { equals: lookup.studentId } },
            { date: { equals: date } },
          ],
        },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      });

      const key = `${lookup.studentId}|${date}`;
      if (existing.totalDocs > 0) {
        const existingDoc = existing.docs[0];
        await payload.update({
          collection: 'attendance',
          id: existingDoc.id,
          data: { status, note: note ?? null },
          overrideAccess: true,
        });
        recordOutcome(result, {
          row: rowNumber,
          status: 'updated',
          studentId: lookup.studentId,
          key,
        });
      } else {
        await payload.create({
          collection: 'attendance',
          data: {
            student: lookup.studentId,
            date,
            status,
            ...(note ? { note } : {}),
          },
          overrideAccess: true,
        });
        recordOutcome(result, {
          row: rowNumber,
          status: 'created',
          studentId: lookup.studentId,
          key,
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
