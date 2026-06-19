import 'server-only';
import type { Payload } from 'payload';
import type { RenewalRequest, TuitionCycle, User } from '@/payload-types';
import { RENEWAL_PROCESSOR_ROLES } from '@/access';

/**
 * Xử lý yêu cầu gia hạn (duyệt/từ chối) — đường dữ liệu tài chính 🔒.
 *
 * Nguyên tắc (đồng bộ với `lib/progress-reports/publish.ts`):
 *  - GATE ROLE TƯỜNG MINH: chỉ kế toán/quản lý/admin (`RENEWAL_PROCESSOR_ROLES`).
 *    Kiểm tra ngay trong core ⇒ unit-test được "role chặn đúng"; đồng thời
 *    collection `renewal-requests` cũng đặt `update: canProcessRenewals` làm hàng
 *    rào DB-level (defense-in-depth, vì ta ghi với `overrideAccess: false`).
 *  - CHỐNG DUYỆT NHẦM/ĐÚP: bắt buộc `confirm === true`; chỉ xử lý yêu cầu đang
 *    CHỜ (`moi | dang_xu_ly`) ⇒ duyệt lại yêu cầu đã chốt KHÔNG sinh thêm chu kỳ.
 *  - GHI CÓ KIỂM SOÁT: mọi I/O qua Local API với `overrideAccess: false` + `user:
 *    actor`. Caller (Server Action) chịu trách nhiệm xác thực đăng nhập nhân viên.
 *
 * Hàm THUẦN nghiệp vụ, KHÔNG đụng next/headers ⇒ unit-test được với Local API.
 */

/** Trạng thái yêu cầu còn xử lý được (chưa chốt/chưa hủy). */
export const PROCESSABLE_RENEWAL_STATUSES: RenewalRequest['status'][] = [
  'moi',
  'dang_xu_ly',
];

/** Gói buổi hợp lệ → tổng số buổi. Khớp options của `TuitionCycles.package`. */
export const RENEWAL_PACKAGE_SESSIONS: Record<TuitionCycle['package'], number> = {
  '10': 10,
  '20': 20,
  '40': 40,
};

/** Giới hạn độ dài ghi chú/lý do để tránh dữ liệu rác. */
export const MAX_NOTE_LENGTH = 1000;

/** Mã lỗi dùng chung cho duyệt/từ chối. */
export type RenewalProcessError =
  | 'forbidden'
  | 'not_confirmed'
  | 'invalid_input'
  | 'not_found'
  | 'already_processed'
  | 'server';

export interface ApproveRenewalInput {
  /** Id yêu cầu gia hạn cần duyệt. */
  id: number;
  /** Gói buổi chốt cho chu kỳ mới ('10' | '20' | '40'). */
  package: TuitionCycle['package'];
  /** Ngày bắt đầu chu kỳ mới (ISO). */
  startDate: string;
  /** Ngày dự kiến hết gói (ISO, tùy chọn). */
  expectedEndDate?: string | null;
  /** Ghi chú nhân viên (tùy chọn). */
  staffNote?: string | null;
  /** Bắt buộc `true`: nhân viên đã xác nhận ở bước hỏi lại trên UI. */
  confirm: boolean;
}

export type ApproveRenewalResult =
  | {
      ok: true;
      requestId: number;
      /** Id chu kỳ học phí vừa được tạo. */
      tuitionCycleId: number;
      /** Id học viên của chu kỳ mới (để UI hiển thị/đối chiếu). */
      studentId: number;
      sessionsTotal: number;
    }
  | { ok: false; error: RenewalProcessError; message: string };

export interface RejectRenewalInput {
  /** Id yêu cầu gia hạn cần từ chối. */
  id: number;
  /** Lý do từ chối — BẮT BUỘC (ghi vào `staffNote`). */
  reason: string;
  /** Bắt buộc `true`: nhân viên đã xác nhận ở bước hỏi lại trên UI. */
  confirm: boolean;
}

export type RejectRenewalResult =
  | { ok: true; requestId: number }
  | { ok: false; error: RenewalProcessError; message: string };

/** Rút id số từ giá trị quan hệ (id | `{ id }`). */
function resolveRelationId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

/** Actor có BẤT KỲ vai trò nào được phép xử lý yêu cầu gia hạn (union). */
function isRenewalProcessor(actor: User | null | undefined): boolean {
  const raw = actor?.role;
  const roles = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const allowed = RENEWAL_PROCESSOR_ROLES as readonly string[];
  return roles.some((r) => allowed.includes(r));
}

/** Ngày hợp lệ → trả ISO; rỗng/không hợp lệ → null. */
function toIsoDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Duyệt yêu cầu gia hạn: tạo chu kỳ học phí mới cho ĐÚNG học viên + chuyển yêu
 * cầu sang `da_chot` và gắn link chu kỳ vừa tạo.
 */
export async function approveRenewalRequest(
  payload: Payload,
  actor: User,
  input: ApproveRenewalInput,
): Promise<ApproveRenewalResult> {
  if (!isRenewalProcessor(actor)) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Chỉ kế toán, quản lý hoặc admin mới được duyệt gia hạn.',
    };
  }
  if (input.confirm !== true) {
    return {
      ok: false,
      error: 'not_confirmed',
      message: 'Cần xác nhận trước khi duyệt yêu cầu gia hạn.',
    };
  }

  const sessionsTotal = RENEWAL_PACKAGE_SESSIONS[input.package];
  if (!sessionsTotal) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Gói buổi không hợp lệ (chỉ 10 / 20 / 40 buổi).',
    };
  }

  const startDate = toIsoDate(input.startDate);
  if (!startDate) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Ngày bắt đầu không hợp lệ.',
    };
  }

  const expectedEndDate = toIsoDate(input.expectedEndDate);
  if (input.expectedEndDate && !expectedEndDate) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Ngày dự kiến hết gói không hợp lệ.',
    };
  }
  if (expectedEndDate && expectedEndDate < startDate) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Ngày dự kiến hết gói phải sau ngày bắt đầu.',
    };
  }

  const staffNote = input.staffNote?.trim() || undefined;
  if (staffNote && staffNote.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `Ghi chú quá dài (tối đa ${MAX_NOTE_LENGTH} ký tự).`,
    };
  }

  let request: RenewalRequest | null = null;
  try {
    request = (await payload.findByID({
      collection: 'renewal-requests',
      id: input.id,
      user: actor,
      overrideAccess: false,
      depth: 0,
    })) as RenewalRequest;
  } catch {
    return {
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy yêu cầu gia hạn (hoặc không có quyền).',
    };
  }

  if (!request) {
    return {
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy yêu cầu gia hạn.',
    };
  }
  if (!PROCESSABLE_RENEWAL_STATUSES.includes(request.status)) {
    return {
      ok: false,
      error: 'already_processed',
      message: 'Yêu cầu này đã được xử lý trước đó.',
    };
  }

  const studentId = resolveRelationId(request.student);
  if (studentId === null) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Yêu cầu gia hạn thiếu học viên hợp lệ.',
    };
  }

  // NGUYÊN TỬ HÓA 🔒: tạo chu kỳ + chốt yêu cầu phải CÙNG một transaction. Nếu
  // bước update lỗi sau khi create thành công mà KHÔNG nguyên tử ⇒ chu kỳ mồ côi
  // + yêu cầu vẫn "đang chờ" ⇒ duyệt lại sinh chu kỳ TRÙNG (sai tiền).
  //  - Adapter hỗ trợ transaction (postgres prod): bọc cả hai trong 1 tx,
  //    commit khi xong, rollback khi lỗi ⇒ không để lại gì.
  //  - Adapter/fake không hỗ trợ (`beginTransaction` undefined, vd unit-test):
  //    rơi về BÙ TRỪ — xóa chu kỳ vừa tạo trong `catch` để không mồ côi.
  const transactionID = (await payload.db?.beginTransaction?.()) ?? undefined;
  const txOpt = transactionID ? { req: { transactionID } } : {};
  let createdCycleId: number | undefined;

  try {
    const cycle = (await payload.create({
      collection: 'tuition-cycles',
      user: actor,
      overrideAccess: false,
      ...txOpt,
      data: {
        student: studentId,
        package: input.package,
        sessionsTotal,
        startDate,
        expectedEndDate: expectedEndDate ?? undefined,
        status: 'dang_hoc',
      },
    })) as TuitionCycle;
    createdCycleId = cycle.id;

    await payload.update({
      collection: 'renewal-requests',
      id: input.id,
      user: actor,
      overrideAccess: false,
      ...txOpt,
      data: {
        status: 'da_chot',
        tuitionCycle: cycle.id,
        ...(staffNote ? { staffNote } : {}),
      },
    });

    if (transactionID) await payload.db.commitTransaction(transactionID);

    return {
      ok: true,
      requestId: input.id,
      tuitionCycleId: cycle.id,
      studentId,
      sessionsTotal,
    };
  } catch (err) {
    if (transactionID) {
      await payload.db.rollbackTransaction(transactionID);
    } else if (createdCycleId !== undefined) {
      // Bù trừ khi không có transaction: gỡ chu kỳ mồ côi ⇒ yêu cầu giữ nguyên
      // trạng thái "đang chờ", nhân viên duyệt lại an toàn (không nhân đôi).
      try {
        await payload.delete({
          collection: 'tuition-cycles',
          id: createdCycleId,
          user: actor,
          overrideAccess: false,
        });
      } catch (delErr) {
        console.error(
          '[approveRenewalRequest] Gỡ chu kỳ mồ côi thất bại — cần soát tay:',
          { cycleId: createdCycleId, delErr },
        );
      }
    }
    console.error('[approveRenewalRequest] Lỗi duyệt gia hạn:', err);
    return {
      ok: false,
      error: 'server',
      message: 'Có lỗi khi duyệt gia hạn. Vui lòng thử lại.',
    };
  }
}

/**
 * Từ chối yêu cầu gia hạn: chuyển sang `da_huy` và ghi lý do vào `staffNote`.
 * KHÔNG tạo chu kỳ học phí.
 */
export async function rejectRenewalRequest(
  payload: Payload,
  actor: User,
  input: RejectRenewalInput,
): Promise<RejectRenewalResult> {
  if (!isRenewalProcessor(actor)) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Chỉ kế toán, quản lý hoặc admin mới được từ chối gia hạn.',
    };
  }
  if (input.confirm !== true) {
    return {
      ok: false,
      error: 'not_confirmed',
      message: 'Cần xác nhận trước khi từ chối yêu cầu gia hạn.',
    };
  }

  const reason = input.reason?.trim();
  if (!reason) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Vui lòng nhập lý do từ chối.',
    };
  }
  if (reason.length > MAX_NOTE_LENGTH) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `Lý do quá dài (tối đa ${MAX_NOTE_LENGTH} ký tự).`,
    };
  }

  let request: RenewalRequest | null = null;
  try {
    request = (await payload.findByID({
      collection: 'renewal-requests',
      id: input.id,
      user: actor,
      overrideAccess: false,
      depth: 0,
    })) as RenewalRequest;
  } catch {
    return {
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy yêu cầu gia hạn (hoặc không có quyền).',
    };
  }

  if (!request) {
    return {
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy yêu cầu gia hạn.',
    };
  }
  if (!PROCESSABLE_RENEWAL_STATUSES.includes(request.status)) {
    return {
      ok: false,
      error: 'already_processed',
      message: 'Yêu cầu này đã được xử lý trước đó.',
    };
  }

  try {
    await payload.update({
      collection: 'renewal-requests',
      id: input.id,
      user: actor,
      overrideAccess: false,
      data: { status: 'da_huy', staffNote: reason },
    });
    return { ok: true, requestId: input.id };
  } catch (err) {
    console.error('[rejectRenewalRequest] Lỗi từ chối gia hạn:', err);
    return {
      ok: false,
      error: 'server',
      message: 'Có lỗi khi từ chối gia hạn. Vui lòng thử lại.',
    };
  }
}
