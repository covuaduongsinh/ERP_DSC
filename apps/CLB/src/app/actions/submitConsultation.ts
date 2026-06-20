'use server'

import { headers } from 'next/headers'
import { getPayloadClient } from '@/lib/payload'
import { isValidVietnamesePhone, normalizePhone } from '@/lib/phone'

// ---------------------------------------------------------------------------
// Rate limiting — in-memory, resets on server restart.
// Mục đích: chống spam cơ bản. Cho production nặng hơn dùng Redis/Upstash.
// ---------------------------------------------------------------------------
const ipStore = new Map<string, { count: number; resetAt: number }>()
const WINDOW_MS = 15 * 60 * 1000 // 15 phút
const MAX_PER_WINDOW = 3

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = ipStore.get(ip)

  if (!entry || now > entry.resetAt) {
    ipStore.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }

  if (entry.count >= MAX_PER_WINDOW) return true

  entry.count += 1
  return false
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------
export type SubmitConsultationResult =
  | { success: true }
  | { success: false; error: 'rateLimit' | 'validation' | 'server'; message: string }

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------
export async function submitConsultation(formData: FormData): Promise<SubmitConsultationResult> {
  // 1. Honeypot — bots điền trường ẩn "website"; người dùng thật không thấy trường này
  if (formData.get('website')) {
    // Giả vờ thành công để bot không biết bị chặn
    return { success: true }
  }

  // 2. Rate limit theo IP
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  if (isRateLimited(ip)) {
    return {
      success: false,
      error: 'rateLimit',
      message: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.',
    }
  }

  // 3. Validate phía server
  const fullName = String(formData.get('fullName') ?? '').trim()
  const phone = String(formData.get('phone') ?? '').trim()
  const childAge = String(formData.get('childAge') ?? '').trim() || undefined
  const locationRaw = String(formData.get('interestedLocation') ?? '').trim()
  const note = String(formData.get('note') ?? '').trim() || undefined

  if (!fullName || fullName.length < 2 || fullName.length > 100) {
    return {
      success: false,
      error: 'validation',
      message: 'Vui lòng nhập họ tên hợp lệ (2–100 ký tự).',
    }
  }

  if (!phone || !isValidVietnamesePhone(phone)) {
    return {
      success: false,
      error: 'validation',
      message: 'Số điện thoại không hợp lệ.',
    }
  }

  if (note && note.length > 1000) {
    return {
      success: false,
      error: 'validation',
      message: 'Ghi chú quá dài (tối đa 1000 ký tự).',
    }
  }

  // 4. Ghi vào collection Leads qua Payload Local API
  try {
    const payload = await getPayloadClient()
    await payload.create({
      collection: 'leads',
      data: {
        fullName,
        phone: normalizePhone(phone),
        childAge,
        // interestedLocation nhận numeric ID; bỏ qua nếu rỗng
        ...(locationRaw ? { interestedLocation: Number(locationRaw) } : {}),
        source: 'khac', // nguồn mặc định cho form web
        status: 'moi',
        note,
      },
      // Action chạy server-side — bỏ qua kiểm tra auth (create đã là anyone)
      overrideAccess: true,
    })

    return { success: true }
  } catch (err) {
    console.error('[submitConsultation] Lỗi ghi lead:', err)
    return {
      success: false,
      error: 'server',
      message: 'Có lỗi xảy ra. Vui lòng thử lại hoặc liên hệ trực tiếp qua điện thoại.',
    }
  }
}
