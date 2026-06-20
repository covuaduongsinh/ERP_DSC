import type { OtpProvider } from './provider'

/**
 * Provider production: gửi OTP qua HTTP tới gateway SMS brandname / Zalo ZNS.
 *
 * THIẾT KẾ:
 * - KHÔNG hardcode bất kỳ key/endpoint/brandname nào — tất cả đọc từ env.
 * - `fromEnv()` fail-fast nếu thiếu biến bắt buộc → tránh chạy prod nửa vời.
 * - KHÔNG bao giờ log mã OTP hay API key (chỉ log status gateway khi lỗi).
 *
 * Biến môi trường (đặt giá trị thật ở `.env`, KHÔNG commit):
 * - OTP_HTTP_ENDPOINT     (bắt buộc) URL API của gateway.
 * - OTP_HTTP_API_KEY      (bắt buộc) khóa bí mật, gửi qua header Authorization.
 * - OTP_HTTP_SENDER       (tùy chọn) brandname / sender ID.
 * - OTP_MESSAGE_TEMPLATE  (tùy chọn) mẫu tin, chứa `{code}`. Mặc định tiếng Việt.
 * - OTP_HTTP_TIMEOUT_MS   (tùy chọn) timeout request, mặc định 8000ms.
 */
export class HttpOtpProvider implements OtpProvider {
  readonly name = 'http'
  readonly exposesCodeToClient = false

  private constructor(
    private readonly endpoint: string,
    private readonly apiKey: string,
    private readonly sender: string | undefined,
    private readonly messageTemplate: string,
    private readonly timeoutMs: number,
  ) {}

  static fromEnv(): HttpOtpProvider {
    const endpoint = process.env.OTP_HTTP_ENDPOINT?.trim()
    const apiKey = process.env.OTP_HTTP_API_KEY?.trim()

    const missing: string[] = []
    if (!endpoint) missing.push('OTP_HTTP_ENDPOINT')
    if (!apiKey) missing.push('OTP_HTTP_API_KEY')
    if (missing.length > 0) {
      throw new Error(`OTP_PROVIDER=prod nhưng thiếu biến môi trường: ${missing.join(', ')}.`)
    }

    const sender = process.env.OTP_HTTP_SENDER?.trim() || undefined
    const messageTemplate =
      process.env.OTP_MESSAGE_TEMPLATE?.trim() ||
      'Ma OTP dang nhap Cong phu huynh Co vua Duong Sinh: {code}. Het han sau 5 phut.'

    const timeoutMs = Number(process.env.OTP_HTTP_TIMEOUT_MS) || 8000

    // Non-null đã được bảo đảm bởi check `missing` ở trên.
    return new HttpOtpProvider(endpoint!, apiKey!, sender, messageTemplate, timeoutMs)
  }

  async sendOtp(phone: string, code: string): Promise<void> {
    const message = this.messageTemplate.replaceAll('{code}', code)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    let res: Response
    try {
      res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          to: phone,
          ...(this.sender ? { sender: this.sender } : {}),
          message,
        }),
        signal: controller.signal,
      })
    } catch (err) {
      // Lỗi mạng/timeout — KHÔNG kèm mã OTP vào thông báo.
      const reason = err instanceof Error ? err.message : 'unknown'
      throw new Error(`Không gọi được gateway OTP: ${reason}`)
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      // Chỉ nêu status — KHÔNG đọc/echo body để tránh lỡ lộ dữ liệu nhạy cảm.
      throw new Error(`Gateway OTP trả lỗi ${res.status} ${res.statusText}.`)
    }
  }
}
