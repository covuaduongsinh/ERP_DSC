// Stub rỗng cho các "marker import" chỉ-môi-trường (`server-only` / `client-only`).
// Chúng throw/không resolve được dưới Vite/vitest; alias về module rỗng này để
// test được các module server thuần (vd lib/progress-reports/publish.ts).
export {}
