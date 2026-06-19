/** @type {import('next').NextConfig} */
const nextConfig = {
  // Bật instrumentation hook (Next 14) để chạy startup NATS event subscriber.
  experimental: {
    instrumentationHook: true,
  },
  // instrumentation kéo @vierp/events (+ @vierp/shared) — TS source — vào graph build,
  // nên cần Next transpile chúng.
  transpilePackages: ['@vierp/events', '@vierp/shared'],
};

export default nextConfig;
