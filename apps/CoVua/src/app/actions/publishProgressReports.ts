'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import {
  publishProgressReports as publishProgressReportsCore,
  type PublishProgressReportsResult,
} from '@/lib/progress-reports/publish';

export type PublishProgressReportsActionResult =
  | PublishProgressReportsResult
  | { ok: false; error: 'forbidden'; message: string };

/**
 * Server Action: phát hành (publish) báo cáo tiến độ cho phụ huynh.
 *
 * Resolve nhân viên đang đăng nhập từ cookie (Payload auth), gate đăng nhập
 * NHÂN VIÊN (khớp `update: staffOnly` của collection — phụ huynh KHÔNG được),
 * rồi gọi core thuần `publishProgressReports`. KHÔNG nhận danh tính từ client.
 *
 * `confirm` đi kèm từ bước hỏi-lại trên UI; core từ chối nếu `confirm !== true`
 * ⇒ chống phát hành nhầm hàng loạt.
 */
export async function publishProgressReports(input: {
  ids: number[];
  confirm: boolean;
}): Promise<PublishProgressReportsActionResult> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });

  // Chỉ nhân viên (collection `users`) — phụ huynh KHÔNG được phát hành.
  if (!user || user.collection !== 'users') {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên để phát hành báo cáo.',
    };
  }

  return publishProgressReportsCore(payload, user as User, {
    ids: input.ids,
    confirm: input.confirm,
  });
}
