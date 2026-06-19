// Barrel: giữ đường import `@/lib/otp` ổn định sau khi tách thành thư mục.

export type { OtpProvider } from './provider';
export { getOtpProvider, _resetOtpProviderForTests } from './provider';

export {
  generateOtpCode,
  hashOtpCode,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
} from './codes';

export {
  consumeOtpSendRateLimit,
  otpSendRateLimitKey,
  OTP_SEND_WINDOW_MS,
  OTP_SEND_MAX_PER_WINDOW,
} from './rate-limit';
