import bundleAnalyzer from '@next/bundle-analyzer'

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  // Bật instrumentation hook (Next 14) để chạy NATS event subscriber lúc khởi động.
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    instrumentationHook: true,
  },
  // instrumentation kéo @vierp/events (+ @vierp/shared, @vierp/master-data) — TS source —
  // vào graph build, nên cần Next transpile chúng.
  transpilePackages: ['@vierp/events', '@vierp/shared', '@vierp/master-data'],
  // CRM có middleware.ts (edge) ⇒ Next biên dịch instrumentation.ts cho CẢ runtime edge.
  // @vierp/events → nats dùng built-in Node (crypto/net/tls…) và CHỈ chạy ở Node
  // (guard NEXT_RUNTIME==='nodejs', không bao giờ thực thi ở edge). Stub các built-in
  // này về rỗng cho bản edge để webpack biên dịch được (không "can't resolve 'crypto'").
  webpack: (config, { nextRuntime }) => {
    if (nextRuntime === 'edge') {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
        net: false,
        tls: false,
        dns: false,
        fs: false,
        path: false,
        os: false,
        zlib: false,
        http: false,
        https: false,
        stream: false,
        url: false,
        string_decoder: false,
      }
    }
    return config
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' https://cdn.jsdelivr.net https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co",
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3018',
          },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'Access-Control-Max-Age', value: '86400' },
        ],
      },
    ]
  },
}

export default withBundleAnalyzer(nextConfig)
