import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Map `@/*` → `src/*` thẳng ở đây thay vì qua vite-tsconfig-paths: tsconfig
  // EXCLUDE thư mục `tests` (để tách khỏi `tsc --noEmit`), nên plugin đó không
  // áp alias cho file test ⇒ "Failed to resolve import @/...". Alias tường minh
  // không lệ thuộc include/exclude của tsconfig.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` / `client-only` là marker import chỉ-môi-trường: Vite
      // không resolve được ⇒ alias về module rỗng để test module server thuần.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty-module.ts', import.meta.url)),
      'client-only': fileURLToPath(new URL('./tests/stubs/empty-module.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
  },
})
