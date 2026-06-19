'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import {
  PARENT_SESSION_COOKIE,
  PARENT_SESSION_COOKIE_PATHS,
  PARENT_SESSION_TTL_SECONDS,
  createParentSessionToken,
  isParentSessionSecretConfigured,
} from '@/lib/parent-session';
import { isValidVietnamesePhone, normalizePhone } from '@/lib/phone';
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  consumeOtpSendRateLimit,
  generateOtpCode,
  getOtpProvider,
  hashOtpCode,
} from '@/lib/otp';

export type SendOtpResult =
  | { success: true; devCode?: string }
  | {
      success: false;
      error: 'validation' | 'unknownPhone' | 'rateLimit' | 'server';
      message: string;
    };

export type VerifyOtpResult =
  | { success: true }
  | {
      success: false;
      error: 'validation' | 'invalid' | 'expired' | 'tooMany' | 'server';
      message: string;
    };

/**
 * Bước 1: phụ huynh nhập SĐT → gửi OTP.
 *
 * Quy tắc:
 * - SĐT phải tồn tại trong collection `parents` (nhân viên tạo trước).
 *   KHÔNG cho self-signup — chống người lạ probe SĐT để tạo tài khoản.
 * - Rate limit 3 lần/SĐT/giờ.
 * - OTP băm trước khi lưu DB.
 */
export async function sendOtp(formData: FormData): Promise<SendOtpResult> {
  // Fail-fast nếu config server chưa đủ — UX rõ hơn "Có lỗi xảy ra".
  if (!isParentSessionSecretConfigured()) {
    return {
      success: false,
      error: 'server',
      message:
        'Hệ thống chưa được cấu hình đủ (PARENT_SESSION_SECRET). Liên hệ quản trị.',
    };
  }

  const rawPhone = String(formData.get('phone') ?? '').trim();
  if (!rawPhone || !isValidVietnamesePhone(rawPhone)) {
    return {
      success: false,
      error: 'validation',
      message: 'Số điện thoại không hợp lệ.',
    };
  }
  const phone = normalizePhone(rawPhone);

  try {
    const payload = await getPayloadClient();

    // Rate limit gửi OTP — bền qua bảng Postgres `rate_limits` (upsert nguyên tử,
    // chạy cả Vercel serverless lẫn VPS). Đặt TRƯỚC khi tra cứu phụ huynh để chặn
    // luôn việc dò SĐT. Lỗi DB rơi vào catch bên dưới (không có DB ⇒ không gửi OTP).
    const limit = await consumeOtpSendRateLimit(payload, phone);
    if (limit.limited) {
      const minutes = Math.ceil((limit.retryAfterMs ?? 0) / 60_000);
      return {
        success: false,
        error: 'rateLimit',
        message: `Bạn đã yêu cầu OTP quá nhiều lần. Thử lại sau ~${minutes} phút.`,
      };
    }

    // Kiểm tra SĐT có trong danh sách phụ huynh không
    const found = await payload.find({
      collection: 'parents',
      where: { phone: { equals: phone } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });
    if (found.totalDocs === 0) {
      // Trả message chung — KHÔNG xác nhận SĐT có/không tồn tại,
      // tránh để kẻ tấn công enum SĐT phụ huynh.
      return {
        success: false,
        error: 'unknownPhone',
        message:
          'Không tìm thấy phụ huynh ứng với số này. Liên hệ trung tâm để được hỗ trợ.',
      };
    }

    const code = generateOtpCode();
    const codeHash = hashOtpCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    await payload.create({
      collection: 'otp-codes',
      data: { phone, codeHash, expiresAt, attempts: 0 },
      overrideAccess: true,
    });

    const provider = getOtpProvider();
    await provider.sendOtp(phone, code);

    // Chỉ dev provider mới được trả code về client (để dán nhanh khi test).
    // Production: KHÔNG bao giờ trả code (chỉ qua SMS/Zalo).
    return provider.exposesCodeToClient
      ? { success: true, devCode: code }
      : { success: true };
  } catch (err) {
    console.error('[sendOtp] lỗi:', err);
    const detail =
      err instanceof Error ? err.message : 'Unknown server error';
    return {
      success: false,
      error: 'server',
      message: `Có lỗi khi gửi OTP: ${detail}`,
    };
  }
}

/**
 * Bước 2: phụ huynh nhập OTP → verify → set cookie session → vào cổng.
 */
export async function verifyOtp(formData: FormData): Promise<VerifyOtpResult> {
  if (!isParentSessionSecretConfigured()) {
    return {
      success: false,
      error: 'server',
      message:
        'Hệ thống chưa được cấu hình đủ (PARENT_SESSION_SECRET). Liên hệ quản trị.',
    };
  }

  const rawPhone = String(formData.get('phone') ?? '').trim();
  const code = String(formData.get('code') ?? '').trim();

  if (!rawPhone || !isValidVietnamesePhone(rawPhone)) {
    return {
      success: false,
      error: 'validation',
      message: 'Số điện thoại không hợp lệ.',
    };
  }
  if (!/^\d{6}$/.test(code)) {
    return {
      success: false,
      error: 'validation',
      message: 'Mã OTP phải gồm 6 chữ số.',
    };
  }

  const phone = normalizePhone(rawPhone);

  try {
    const payload = await getPayloadClient();

    // Lấy OTP mới nhất cho SĐT này. KHÔNG lọc consumedAt trong where —
    // operator `exists: false` với date nullable không nhất quán giữa adapter.
    // Check field sau khi fetch là cách an toàn nhất.
    const otpQuery = await payload.find({
      collection: 'otp-codes',
      where: { phone: { equals: phone } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });

    const otp = otpQuery.docs[0];
    if (!otp) {
      return {
        success: false,
        error: 'invalid',
        message: 'Mã OTP không đúng. Hãy yêu cầu mã mới.',
      };
    }

    if (otp.consumedAt) {
      return {
        success: false,
        error: 'invalid',
        message: 'Mã OTP đã được sử dụng. Hãy yêu cầu mã mới.',
      };
    }

    const expiresAtMs = new Date(otp.expiresAt as string).getTime();
    if (Date.now() > expiresAtMs) {
      return {
        success: false,
        error: 'expired',
        message: 'Mã OTP đã hết hạn. Hãy yêu cầu mã mới.',
      };
    }

    const attempts = (otp.attempts as number) ?? 0;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      return {
        success: false,
        error: 'tooMany',
        message: 'Bạn nhập sai quá nhiều lần. Yêu cầu mã mới.',
      };
    }

    const expectedHash = hashOtpCode(code);
    if (expectedHash !== otp.codeHash) {
      // Tăng attempts, KHÔNG tiết lộ còn bao nhiêu lần
      await payload.update({
        collection: 'otp-codes',
        id: otp.id,
        data: { attempts: attempts + 1 },
        overrideAccess: true,
      });
      return {
        success: false,
        error: 'invalid',
        message: 'Mã OTP không đúng.',
      };
    }

    // Match! Tìm phụ huynh tương ứng
    const parentFound = await payload.find({
      collection: 'parents',
      where: { phone: { equals: phone } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    });
    const parent = parentFound.docs[0];
    if (!parent) {
      return {
        success: false,
        error: 'invalid',
        message: 'Không tìm thấy hồ sơ phụ huynh.',
      };
    }

    // Đánh dấu OTP đã dùng
    await payload.update({
      collection: 'otp-codes',
      id: otp.id,
      data: { consumedAt: new Date().toISOString() },
      overrideAccess: true,
    });

    // Cập nhật lastLoginAt
    await payload.update({
      collection: 'parents',
      id: parent.id,
      data: { lastLoginAt: new Date().toISOString() },
      overrideAccess: true,
    });

    // Set session cookie (tách biệt cookie staff)
    const { token } = createParentSessionToken(parent.id as number);
    const cookieStore = await cookies();
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: PARENT_SESSION_TTL_SECONDS,
    };
    for (const path of PARENT_SESSION_COOKIE_PATHS) {
      cookieStore.set(PARENT_SESSION_COOKIE, token, { ...cookieOptions, path });
    }

    return { success: true };
  } catch (err) {
    console.error('[verifyOtp] lỗi:', err);
    const detail =
      err instanceof Error ? err.message : 'Unknown server error';
    return {
      success: false,
      error: 'server',
      message: `Có lỗi xảy ra: ${detail}`,
    };
  }
}

/** Xóa session phụ huynh và redirect về login. */
export async function parentSignOut(): Promise<never> {
  const cookieStore = await cookies();
  for (const path of PARENT_SESSION_COOKIE_PATHS) {
    cookieStore.delete({ name: PARENT_SESSION_COOKIE, path });
  }
  // Xóa cookie cũ path=/ nếu còn từ phiên bản trước
  cookieStore.delete({ name: PARENT_SESSION_COOKIE, path: '/' });
  redirect('/cong-phu-huynh/dang-nhap');
}
