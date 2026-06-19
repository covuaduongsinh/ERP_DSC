'use server';

import { getCurrentParent } from '@/lib/parent-auth';
import {
  isTuitionLow,
  sessionsRemaining,
  toParentPayloadUser,
} from '@/lib/parent-portal';
import { getPayloadClient } from '@/lib/payload';

export type SubmitRenewalRequestResult =
  | { success: true; message: string }
  | {
      success: false;
      error: 'auth' | 'validation' | 'duplicate' | 'notLow' | 'server';
      message: string;
    };

export async function submitRenewalRequest(
  formData: FormData,
): Promise<SubmitRenewalRequestResult> {
  const parent = await getCurrentParent();
  if (!parent) {
    return {
      success: false,
      error: 'auth',
      message: 'Vui lòng đăng nhập lại để gửi yêu cầu gia hạn.',
    };
  }

  const parentUser = toParentPayloadUser(parent);
  const studentIdRaw = String(formData.get('studentId') ?? '').trim();
  const tuitionCycleIdRaw = String(formData.get('tuitionCycleId') ?? '').trim();
  const parentNote = String(formData.get('parentNote') ?? '').trim() || undefined;

  const studentId = Number.parseInt(studentIdRaw, 10);
  if (!Number.isFinite(studentId) || studentId <= 0) {
    return {
      success: false,
      error: 'validation',
      message: 'Thông tin học viên không hợp lệ.',
    };
  }

  const childIds = (parent.children ?? [])
    .map((c) => (typeof c === 'number' ? c : c?.id))
    .filter((id): id is number => typeof id === 'number');

  if (!childIds.includes(studentId)) {
    return {
      success: false,
      error: 'validation',
      message: 'Bạn không thể gửi yêu cầu cho học viên này.',
    };
  }

  if (parentNote && parentNote.length > 500) {
    return {
      success: false,
      error: 'validation',
      message: 'Ghi chú quá dài (tối đa 500 ký tự).',
    };
  }

  try {
    const payload = await getPayloadClient();

    const tuitionCycleId = tuitionCycleIdRaw
      ? Number.parseInt(tuitionCycleIdRaw, 10)
      : null;

    let tuitionCycle = null;
    if (tuitionCycleId && Number.isFinite(tuitionCycleId)) {
      try {
        tuitionCycle = await payload.findByID({
          collection: 'tuition-cycles',
          id: tuitionCycleId,
          user: parentUser,
          // Bắt buộc enforce access: cycle phải thuộc con của phụ huynh này.
          // Nếu không, phụ huynh A có thể truyền id cycle của con phụ huynh B.
          overrideAccess: false,
          depth: 0,
        });
      } catch {
        tuitionCycle = null;
      }
    }

    if (!tuitionCycle) {
      const cycles = await payload.find({
        collection: 'tuition-cycles',
        user: parentUser,
        overrideAccess: false,
        where: {
          and: [
            { student: { equals: studentId } },
            { status: { in: ['dang_hoc', 'sap_het'] } },
          ],
        },
        sort: '-startDate',
        limit: 1,
        depth: 0,
      });
      tuitionCycle = cycles.docs[0] ?? null;
    }

    if (!tuitionCycle || !isTuitionLow(tuitionCycle)) {
      return {
        success: false,
        error: 'notLow',
        message: 'Gói buổi chưa đến mức cần gia hạn.',
      };
    }

    const existing = await payload.find({
      collection: 'renewal-requests',
      user: parentUser,
      overrideAccess: false,
      where: {
        and: [
          { student: { equals: studentId } },
          { status: { in: ['moi', 'dang_xu_ly'] } },
        ],
      },
      limit: 1,
      depth: 0,
    });

    if (existing.totalDocs > 0) {
      return {
        success: false,
        error: 'duplicate',
        message:
          'Bạn đã gửi yêu cầu gia hạn. Nhân viên sẽ liên hệ trong thời gian sớm nhất.',
      };
    }

    await payload.create({
      collection: 'renewal-requests',
      user: parentUser,
      // createRenewalForOwnChild kiểm tra parent==self & student∈children.
      overrideAccess: false,
      data: {
        student: studentId,
        parent: parent.id,
        tuitionCycle: tuitionCycle.id,
        sessionsRemaining: sessionsRemaining(tuitionCycle),
        parentNote,
        status: 'moi',
      },
    });

    return {
      success: true,
      message:
        'Đã gửi yêu cầu gia hạn. Nhân viên sẽ liên hệ để tư vấn và chốt gói mới.',
    };
  } catch (err) {
    console.error('[submitRenewalRequest] Lỗi ghi yêu cầu:', err);
    return {
      success: false,
      error: 'server',
      message: 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ trung tâm trực tiếp.',
    };
  }
}
