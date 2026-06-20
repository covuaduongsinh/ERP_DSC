import type { OtpProvider } from './provider'

/**
 * Provider phát triển: in OTP ra console. KHÔNG cần key, KHÔNG gửi gì ra ngoài.
 * Đây là kênh duy nhất để xem OTP khi chạy local/test.
 */
export class DevConsoleProvider implements OtpProvider {
  readonly name = 'dev-console'
  readonly exposesCodeToClient = true

  async sendOtp(phone: string, code: string): Promise<void> {
    // KHÔNG đổi sang logger im lặng — đây là kênh duy nhất để xem OTP ở dev.
    console.log(
      `\n[OTP dev] ===========================================\n` +
        `  SĐT  : ${phone}\n` +
        `  Mã   : ${code}\n` +
        `  Hạn  : 5 phút\n` +
        `=================================================\n`,
    )
  }
}
