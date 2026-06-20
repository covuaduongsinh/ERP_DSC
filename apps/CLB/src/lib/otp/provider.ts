import { DevConsoleProvider } from './dev-provider'
import { HttpOtpProvider } from './prod-provider'

/**
 * Lớp trừu tượng cho nhà cung cấp OTP.
 *
 * Hai impl:
 * - `dev`  → in OTP ra console (không cần key, dùng khi phát triển/test).
 * - `prod` → gọi gateway SMS brandname / Zalo ZNS qua HTTP, đọc cấu hình từ
 *            env (KHÔNG hardcode key). Xem `./prod-provider.ts`.
 *
 * Chọn provider qua biến môi trường `OTP_PROVIDER` (mặc định `dev`).
 */
export interface OtpProvider {
  /** Tên định danh provider, dùng cho log/chẩn đoán. */
  readonly name: string
  /**
   * Khi `true`, server action ĐƯỢC PHÉP trả mã OTP về client để dán nhanh khi
   * test. Chỉ dev provider bật cờ này; prod LUÔN `false` (mã chỉ đến qua SMS).
   */
  readonly exposesCodeToClient: boolean
  /** Gửi mã OTP tới số điện thoại đã chuẩn hóa (VD: 0987654321). */
  sendOtp(phone: string, code: string): Promise<void>
}

let providerCache: OtpProvider | null = null

export function getOtpProvider(): OtpProvider {
  if (providerCache) return providerCache

  const which = (process.env.OTP_PROVIDER ?? 'dev').toLowerCase()
  switch (which) {
    case 'dev':
      providerCache = new DevConsoleProvider()
      break
    case 'prod':
      // fromEnv() fail-fast nếu thiếu biến cấu hình → bật prod đúng nghĩa
      // chỉ khi env đã có đủ.
      providerCache = HttpOtpProvider.fromEnv()
      break
    default:
      throw new Error(`OTP_PROVIDER="${which}" chưa được hỗ trợ. Hợp lệ: "dev" | "prod".`)
  }
  return providerCache
}

/** Xóa cache provider — chỉ dùng trong test khi đổi env giữa các ca. */
export function _resetOtpProviderForTests(): void {
  providerCache = null
}
