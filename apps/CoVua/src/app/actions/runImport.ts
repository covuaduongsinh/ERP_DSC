'use server';

import { headers as nextHeaders } from 'next/headers';
import { getPayloadClient } from '@/lib/payload';
import { parseSpreadsheetServer } from '@/lib/imports/parse';
import { runImport } from '@/lib/imports/run';
import type { PreviewResult } from '@/lib/imports/run';
import { isImportKind } from '@/lib/imports/kinds';

export type ProcessImportResponse =
  | { ok: true; result: PreviewResult }
  | { ok: false; error: string };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * Server Action điều phối luồng Import CSV trong /admin (5 loại collection).
 *
 * Hai chế độ qua `mode`:
 *  - 'preview' (mặc định) ⇒ DRY-RUN: khớp + kiểm hợp lệ, phân loại tạo/cập
 *    nhật/lỗi NHƯNG KHÔNG ghi DB. Dùng cho bước xem trước.
 *  - 'commit' ⇒ ghi thật + ghi một bản Nhật ký import (import-logs).
 *
 * Bảo vệ:
 * - CHỈ staff (User collection) chạy được.
 * - Re-parse file trên server (KHÔNG tin preview client) — chống giả mạo dữ liệu.
 * - Giới hạn 5MB. Mọi thao tác DB qua importer đã overrideAccess (đã verify quyền).
 *
 * ⏱️ TIMEOUT: action này ghi hàng trăm bản ghi tuần tự khi commit file lớn. Giới
 * hạn thời gian thực thi serverless được nới ở route /admin gọi nó —
 * `export const maxDuration` trong app/(payload)/admin/[[...segments]]/page.tsx.
 * File rất lớn sau này nên chuyển sang commit theo lô (offset/limit) do client lặp.
 */
export async function processImport(
  formData: FormData,
): Promise<ProcessImportResponse> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });

  if (!user || user.collection !== 'users') {
    return { ok: false, error: 'Chỉ nhân viên đăng nhập /admin mới import được.' };
  }

  const kindRaw = String(formData.get('kind') ?? '');
  if (!isImportKind(kindRaw)) {
    return { ok: false, error: 'Loại import không hợp lệ.' };
  }
  const kind = kindRaw;

  const dryRun = String(formData.get('mode') ?? 'preview') !== 'commit';

  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return { ok: false, error: 'Thiếu file. Hãy chọn file Excel/CSV.' };
  }
  if (fileEntry.size === 0) {
    return { ok: false, error: 'File rỗng.' };
  }
  if (fileEntry.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `File quá lớn (>${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB). Chia nhỏ file rồi thử lại.`,
    };
  }

  let parsed;
  try {
    parsed = await parseSpreadsheetServer(fileEntry);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Không đọc được file: ${err.message}`
          : 'Không đọc được file.',
    };
  }

  if (parsed.headers.length === 0 || parsed.rows.length === 0) {
    return { ok: false, error: 'File không có dòng dữ liệu sau dòng tiêu đề.' };
  }

  let result: PreviewResult;
  try {
    result = await runImport(payload, kind, fileEntry.name, parsed.rows, {
      dryRun,
    });
  } catch (err) {
    console.error('[processImport] lỗi không bắt được:', err);
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Lỗi server: ${err.message}`
          : 'Lỗi server không xác định.',
    };
  }

  // Ghi nhật ký CHỈ khi commit (ghi thật). Bọc try/catch để lỗi nhật ký không
  // làm hỏng phản hồi import cho nhân viên.
  if (!dryRun) {
    try {
      await writeImportLog(payload, user.id as number, result);
    } catch (logErr) {
      console.error('[processImport] ghi nhật ký thất bại:', logErr);
    }
  }

  return { ok: true, result };
}

const ERROR_SAMPLE_LIMIT = 12;

async function writeImportLog(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  userId: number,
  result: PreviewResult,
): Promise<void> {
  const errors = result.outcomes.filter((o) => o.status === 'error');
  const errorSample = errors
    .slice(0, ERROR_SAMPLE_LIMIT)
    .map((o) => `Dòng ${o.row}${o.field ? ` (${o.field})` : ''}: ${o.detail ?? ''}`)
    .join('\n');

  await payload.create({
    collection: 'import-logs',
    data: {
      kind: result.kind,
      fileName: result.fileName,
      user: userId,
      rowsTotal: result.totalRows,
      rowsCreated: result.created,
      rowsUpdated: result.updated,
      rowsSkipped: result.skipped,
      rowsErrors: result.errors,
      notes: result.notes.join('\n') || undefined,
      errorSample: errorSample || undefined,
    },
    overrideAccess: true,
  });
}
