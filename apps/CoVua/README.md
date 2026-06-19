# apps/web — Cờ vua Dương Sinh (Hub Site)

Next.js 15 + Payload CMS 3, nhúng trong cùng một app. Database: Supabase PostgreSQL qua `@payloadcms/db-postgres`.

---

## Yêu cầu

- Node.js ≥ 20
- pnpm ≥ 9
- Tài khoản Supabase (project đã tạo, lấy connection string từ Settings → Database → Connection pooling → Transaction mode)

---

## Chạy dev (local)

```bash
# Từ thư mục gốc monorepo (covuaduongsinh/)
cp apps/web/.env.example apps/web/.env
# Điền đủ các biến trong apps/web/.env (xem bảng bên dưới).
# Dev: NEXT_PUBLIC_SERVER_URL=http://localhost:3005 — phải khớp cổng dev server,
# nếu không Payload chặn đăng nhập /admin vì CORS/CSRF.

pnpm install

# Tạo schema trên DB — Payload KHÔNG tự tạo bảng (xem mục "Migration" bên dưới)
pnpm --filter @ds/web payload migrate

pnpm dev
```

Mở trình duyệt:
- **Frontend:** `http://localhost:3005`
- **CMS Admin:** `http://localhost:3005/admin` → tạo tài khoản nhân viên đầu tiên

> Payload đặt `push: false` trong `payload.config.ts` nên **không tự tạo/đồng bộ bảng** khi chạy dev. Trên DB trống, phải chạy `pnpm --filter @ds/web payload migrate` (lệnh ở trên) để tạo toàn bộ schema trước khi `pnpm dev`. DB trống thì migrate chạy thẳng, không hỏi prompt.

---

## Biến môi trường

Tạo file `apps/web/.env` (không commit — đã có trong `.gitignore`).

| Biến | Bắt buộc | Mô tả |
|---|---|---|
| `DATABASE_URI` | ✅ | Connection string Supabase Postgres (pooler, transaction mode). Dạng: `postgresql://postgres.[ref]:[pass]@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| `PAYLOAD_SECRET` | ✅ | Chuỗi bí mật ngẫu nhiên ≥ 32 ký tự để Payload ký JWT. Tạo bằng: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SERVER_URL` | ✅ | URL gốc của app — dùng cho CORS/CSRF của Payload. Dev: `http://localhost:3005` (đúng cổng dev server). Production: `https://covuaduongsinh.com` |
| `NEXT_PUBLIC_GA_ID` | ❌ | Google Analytics 4 Measurement ID (dạng `G-XXXXXXXXXX`). Bỏ trống để tắt. |
| `NEXT_PUBLIC_FB_PIXEL_ID` | ❌ | Facebook Pixel ID (dạng số). Bỏ trống để tắt. |
| `PARENT_SESSION_SECRET` | ✅ (GĐ4) | Bí mật ký session cổng phụ huynh — **tách riêng** khỏi `PAYLOAD_SECRET`. ≥ 32 ký tự, tạo bằng `openssl rand -hex 32`. |
| `OTP_PROVIDER` | ❌ | Hiện chỉ hỗ trợ `dev` (in OTP ra console + trả về client). Mặc định `dev` nếu để trống. |

> `NEXT_PUBLIC_*` chỉ dùng cho ID công khai (analytics). Secrets (`DATABASE_URI`, `PAYLOAD_SECRET`) **không bao giờ** có tiền tố `NEXT_PUBLIC_`.

---

## Migration (thay đổi schema)

`payload.config.ts` đặt `push: false` → schema **chỉ** đổi qua file migration trong `src/migrations/`, không bao giờ auto-push/auto-sync. Mỗi migration được đăng ký ở `src/migrations/index.ts`.

```bash
# Áp toàn bộ migration chưa chạy lên DB (đọc DATABASE_URI từ .env)
pnpm --filter @ds/web payload migrate

# Sinh lại types sau khi đổi schema (non-interactive, an toàn)
pnpm --filter @ds/web generate:types
```

> **Tạo migration mới:** convention của repo là **viết tay** file additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TYPE … EXCEPTION duplicate_object`, unique index) trong `src/migrations/` rồi đăng ký vào `index.ts`. KHÔNG dùng `payload migrate:create` — trong môi trường này nó dừng ở prompt tương tác (hỏi rename enum) nên không drive được từ shell.

---

## Deploy lên Vercel

### Lần đầu

1. Import repo GitHub vào Vercel. Chọn **Root Directory:** `apps/web`. Output `.next` (tự detect).
2. Thêm các biến môi trường (Settings → Environment Variables):
   - `DATABASE_URI` — connection string Supabase production
   - `PAYLOAD_SECRET` — bí mật production (khác với dev)
   - `NEXT_PUBLIC_SERVER_URL` — `https://covuaduongsinh.com`
   - `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_FB_PIXEL_ID` (nếu có)
3. Đặt **Build Command:** `pnpm --filter @ds/web payload migrate && pnpm build` — vì `push: false`, Payload không tự chạy migration; phải áp migration vào DB production trước khi build (hoặc chạy thủ công `pnpm --filter @ds/web payload migrate` với `DATABASE_URI` production).
4. Deploy.

### Các lần sau

Push lên nhánh `main` → Vercel tự build và deploy.

### Lưu ý Vercel

- **Không dùng** `db-vercel-postgres` — dự án dùng `@payloadcms/db-postgres` để portable.
- Payload CMS yêu cầu **Node.js runtime** (không phải Edge). Mặc định Vercel dùng Node.js — không cần cấu hình thêm.
- Nếu dùng Vercel free tier: build timeout 45 phút, serverless function timeout 10 giây. Với tải nhẹ của phase 1, không vấn đề.

---

## Chuyển sang VPS (tự quản)

Không cần viết lại code — chỉ cần đổi môi trường:

1. Cài Node.js ≥ 20, pnpm trên VPS.
2. Clone repo, `pnpm install`, tạo `.env` với thông tin production.
3. Áp migration: `pnpm --filter @ds/web payload migrate`.
4. `pnpm build && pnpm --filter @ds/web start` (hoặc dùng PM2). `next start` mặc định nghe cổng `3000`; đặt `PORT` nếu muốn cổng khác.
5. Cấu hình Nginx reverse proxy về cổng mà `next start` đang nghe (mặc định `localhost:3000`).
6. Chứng chỉ SSL: Let's Encrypt (certbot).

---

## Cấu trúc thư mục chính

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (frontend)/          # Các trang public (Next.js App Router)
│   │   └── (payload)/           # Admin UI của Payload
│   ├── collections/             # Schema + access control từng collection CMS
│   ├── access/                  # Helper: anyone, isAuthenticated
│   ├── lib/                     # payload.ts (getPayloadClient), phone, seo utils
│   ├── app/actions/             # Server Actions (submitConsultation.ts — ghi Lead)
│   ├── components/              # UI components
│   ├── i18n/                    # next-intl config
│   └── payload.config.ts        # Cấu hình Payload (DB, collections, cors, csrf)
├── messages/                    # Chuỗi i18n (vi.json, ...)
├── .env.example                 # Template biến môi trường
└── next.config.ts               # withPayload(withNextIntl(...))
```

---

## Collections & phân quyền

| Collection | Đọc | Tạo | Sửa/Xóa |
|---|---|---|---|
| Leads | Nhân viên | Public (form web) | Nhân viên |
| Posts, Classes, Coaches, Locations, Events, FeaturedBooks, Media | Public | Nhân viên | Nhân viên |
| Users (nhân viên) | Nhân viên | Nhân viên | Nhân viên |
| Parents (phụ huynh) | Nhân viên / chính phụ huynh | Nhân viên | Nhân viên |
| Students | Nhân viên / phụ huynh (chỉ con mình) | Nhân viên | Nhân viên |
| ProgressReports | Nhân viên / phụ huynh (con mình + đã publish) | Nhân viên | Nhân viên |
| Attendance, TuitionReminders | Nhân viên / phụ huynh (chỉ con mình) | Nhân viên | Nhân viên |
| OtpCodes | KHÔNG ai (chỉ Server Actions) | KHÔNG ai (chỉ Server Actions) | KHÔNG ai |

---

## Lệnh hữu ích

```bash
# Type check
pnpm type-check

# Lint
pnpm lint

# Build production
pnpm build

# Xem schema Payload (tự sinh)
# src/payload-types.ts (không sửa tay)
```
