import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  transpilePackages: ['@ds/brand'],
  // Limit static generation workers to 1 so parallel page renders don't
  // exhaust the Supabase session-mode connection pool (capped at 15).
  experimental: {
    cpus: 1,
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    remotePatterns: [
      // Supabase Storage (back-compat)
      ...(process.env.SUPABASE_PUBLIC_URL
        ? [
            {
              protocol: 'https' as const,
              hostname: new URL(process.env.SUPABASE_PUBLIC_URL).hostname,
              pathname: '/storage/v1/object/public/**',
            },
          ]
        : []),
      // MinIO / generic S3 (self-host) — host lấy từ S3_PUBLIC_URL
      ...(process.env.S3_PUBLIC_URL
        ? [
            {
              protocol: new URL(process.env.S3_PUBLIC_URL).protocol.replace(':', '') as
                | 'http'
                | 'https',
              hostname: new URL(process.env.S3_PUBLIC_URL).hostname,
              port: new URL(process.env.S3_PUBLIC_URL).port || undefined,
              pathname: '/**',
            },
          ]
        : []),
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(withNextIntl(nextConfig), {
  devBundleServerPackages: false,
})
