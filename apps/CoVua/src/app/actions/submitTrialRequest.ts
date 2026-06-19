'use server';

import { headers } from 'next/headers';
import type { Class } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import { isValidVietnamesePhone, normalizePhone } from '@/lib/phone';

// ---------------------------------------------------------------------------
// Rate limiting — in-memory, resets on server restart (giống submitConsultation).
// Mục đích: chống spam cơ bản. Cho production nặng hơn dùng Redis/Upstash.
// ---------------------------------------------------------------------------
const ipStore = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000; // 15 phút
const MAX_PER_WINDOW = 3;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipStore.get(ip);

  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_PER_WINDOW) return true;

  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
export type SubmitTrialRequestResult =
  | { success: true }
  | { success: false; error: 'rateLimit' | 'validation' | 'server'; message: string };

// ---------------------------------------------------------------------------
// Server Action — ghi Lead "đăng ký học thử" gắn lớp phụ huynh chọn trên website.
// Bảo mật: status + interestedLocation do SERVER kiểm soát (không tin client);
// chỉ chấp nhận lớp tồn tại + đang mở.
// ---------------------------------------------------------------------------
export async function submitTrialRequest(
  formData: FormData,
): Promise<SubmitTrialRequestResult> {
  // 1. Honeypot — bot điền trường ẩn "website"; người dùng thật không thấy
  if (formData.get('website')) {
    return { success: true };
  }

  // 2. Rate limit theo IP
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return {
      success: false,
      error: 'rateLimit',
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
    };
  }

  // 3. Validate phía server
  const fullName = String(formData.get('fullName') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const childAge = String(formData.get('childAge') ?? '').trim() || undefined;
  const classIdRaw = String(formData.get('interestedClass') ?? '').trim();

  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    return {
      success: false,
      error: 'validation',
      message: 'Vui lòng nhập họ tên hợp lệ (2–100 ký tự).',
    };
  }

  if (!phone || !isValidVietnamesePhone(phone)) {
    return {
      success: false,
      error: 'validation',
      message: 'Số điện thoại không hợp lệ.',
    };
  }

  const classId = Number(classIdRaw);
  if (!classIdRaw || !Number.isInteger(classId) || classId <= 0) {
    return {
      success: false,
      error: 'validation',
      message: 'Lớp học không hợp lệ.',
    };
  }

  // 4. Ghi vào collection Leads qua Payload Local API
  try {
    const payload = await getPayloadClient();

    // Xác thực lớp tồn tại + đang mở (server kiểm soát — KHÔNG tin client).
    let openClass: Class | null = null;
    try {
      openClass = await payload.findByID({
        collection: 'classes',
        id: classId,
        depth: 0,
        overrideAccess: false,
      });
    } catch {
      openClass = null;
    }

    if (!openClass || openClass.trangThai !== 'dang_mo') {
      return {
        success: false,
        error: 'validation',
        message: 'Lớp học không còn nhận đăng ký học thử.',
      };
    }

    // Cơ sở lấy TỪ lớp (server kiểm soát), không nhận id cơ sở từ client.
    const locationId =
      typeof openClass.location === 'number'
        ? openClass.location
        : (openClass.location?.id ?? null);

    await payload.create({
      collection: 'leads',
      data: {
        fullName,
        phone: normalizePhone(phone),
        childAge,
        source: 'khac',
        status: 'dang_ky_hoc_thu',
        interestedClass: classId,
        ...(locationId ? { interestedLocation: locationId } : {}),
        note: `Đăng ký học thử lớp: ${openClass.title}`,
      },
      // Action chạy server-side — bỏ qua kiểm tra auth (create đã là anyone),
      // status được đặt bằng giá trị server kiểm soát nên an toàn.
      overrideAccess: true,
    });

    return { success: true };
  } catch (err) {
    console.error('[submitTrialRequest] Lỗi ghi lead học thử:', err);
    return {
      success: false,
      error: 'server',
      message: 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ trực tiếp qua điện thoại.',
    };
  }
}
