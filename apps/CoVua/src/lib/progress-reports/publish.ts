import 'server-only';
import type { Payload, Where } from 'payload';
import type { ProgressReport, User } from '@/payload-types';

/**
 * Phát hành báo cáo tiến độ cho phụ huynh (đường dữ liệu khách hàng 🔒).
 *
 * Nguyên tắc:
 *  - GUARD ẨN NHÁP GIỮ NGUYÊN: phụ huynh chỉ thấy báo cáo `publishedAt != null`
 *    (xem `ProgressReports.access.read` + test parent-isolation). Hàm này CHỈ
 *    set `publishedAt`; KHÔNG đụng tới access control của collection.
 *  - CHỐNG PHÁT HÀNH NHẦM HÀNG LOẠT: bắt buộc `confirm === true` và danh sách
 *    `ids` TƯỜNG MINH (không có lối tắt "phát hành tất cả"); chặn lô quá lớn.
 *  - IDEMPOTENT: chỉ stamp báo cáo đang là NHÁP (`publishedAt = null`). Báo cáo
 *    đã phát hành trước đó được giữ nguyên ngày cũ (không churn `publishedAt`,
 *    không "phát hành lại").
 *  - GHI CÓ KIỂM SOÁT: Local API với `overrideAccess: false` + `user: actor`
 *    ⇒ `update: staffOnly` của collection vẫn là hàng rào (defense-in-depth).
 *    Caller (Server Action) chịu trách nhiệm GATE đăng nhập nhân viên trước.
 *
 * Hàm THUẦN nghiệp vụ, KHÔNG đụng next/headers ⇒ unit-test được với Local API.
 */

/** Báo cáo còn nháp = phụ huynh chưa thấy. Dùng chung cho đếm + danh sách. */
export const DRAFT_PROGRESS_REPORTS_WHERE: Where = {
  publishedAt: { equals: null },
};

/**
 * Trần số báo cáo phát hành trong một lần — phòng thủ chống thao tác nhầm
 * "chọn tất → phát hành" trên tập rất lớn. Hàng đợi thực tế chỉ vài chục nháp.
 */
export const MAX_PUBLISH_BATCH = 200;

export interface PublishProgressReportsInput {
  /** Id các báo cáo cần phát hành (tường minh — không có "phát hành tất cả"). */
  ids: number[];
  /** Bắt buộc `true`: nhân viên đã xác nhận ở bước hỏi lại trên UI. */
  confirm: boolean;
}

export type PublishProgressReportsResult =
  | {
      ok: true;
      /** Số id hợp lệ đã yêu cầu (sau khi khử trùng). */
      requested: number;
      /** Số báo cáo NHÁP vừa được phát hành lần này. */
      published: number;
      /** Id vừa phát hành (đã stamp `publishedAt`). */
      publishedIds: number[];
      /** Id đã phát hành từ trước ⇒ bỏ qua (không stamp lại). */
      alreadyPublishedIds: number[];
      /** Id không tìm thấy / không có quyền đọc ⇒ bỏ qua. */
      notFoundIds: number[];
      /** Mốc thời gian phát hành dùng cho cả lô (ISO). */
      publishedAt: string;
    }
  | {
      ok: false;
      error: 'not_confirmed' | 'no_ids' | 'too_many' | 'server';
      message: string;
    };

/** Chuẩn hóa danh sách id: chỉ số nguyên dương, khử trùng, giữ thứ tự. */
function normalizeIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const raw of ids) {
    const id = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export async function publishProgressReports(
  payload: Payload,
  actor: User,
  input: PublishProgressReportsInput,
): Promise<PublishProgressReportsResult> {
  if (input.confirm !== true) {
    return {
      ok: false,
      error: 'not_confirmed',
      message: 'Cần xác nhận trước khi phát hành báo cáo cho phụ huynh.',
    };
  }

  const ids = normalizeIds(input.ids);
  if (ids.length === 0) {
    return {
      ok: false,
      error: 'no_ids',
      message: 'Chưa chọn báo cáo nào để phát hành.',
    };
  }
  if (ids.length > MAX_PUBLISH_BATCH) {
    return {
      ok: false,
      error: 'too_many',
      message: `Chỉ phát hành tối đa ${MAX_PUBLISH_BATCH} báo cáo mỗi lần. Hãy chia nhỏ.`,
    };
  }

  const publishedAt = new Date().toISOString();
  const publishedIds: number[] = [];
  const alreadyPublishedIds: number[] = [];
  const notFoundIds: number[] = [];

  try {
    for (const id of ids) {
      let doc: ProgressReport | null = null;
      try {
        doc = (await payload.findByID({
          collection: 'progress-reports',
          id,
          user: actor,
          overrideAccess: false,
          depth: 0,
        })) as ProgressReport;
      } catch {
        // Không tìm thấy / không có quyền đọc ⇒ bỏ qua (không làm hỏng cả lô).
        notFoundIds.push(id);
        continue;
      }

      if (!doc) {
        notFoundIds.push(id);
        continue;
      }
      // Đã phát hành ⇒ giữ nguyên ngày cũ (idempotent, không "phát hành lại").
      if (doc.publishedAt) {
        alreadyPublishedIds.push(id);
        continue;
      }

      await payload.update({
        collection: 'progress-reports',
        id,
        user: actor,
        overrideAccess: false,
        data: { publishedAt },
      });
      publishedIds.push(id);
    }
  } catch (err) {
    console.error('[publishProgressReports] Lỗi phát hành:', err);
    return {
      ok: false,
      error: 'server',
      message: 'Có lỗi khi phát hành. Vui lòng thử lại.',
    };
  }

  return {
    ok: true,
    requested: ids.length,
    published: publishedIds.length,
    publishedIds,
    alreadyPublishedIds,
    notFoundIds,
    publishedAt,
  };
}
