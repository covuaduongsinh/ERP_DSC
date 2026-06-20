# Tích hợp CLB (Cờ vua Dương Sinh) vào ERP_DSC

App `covuaduongsinh` (Next 15 + Payload CMS 3) đã được **gộp vào monorepo ERP_DSC** thành
`apps/CLB` (+ `packages/brand`). Tài liệu này tóm tắt thay đổi, cách chạy/deploy, và các
điểm cần lưu ý.

## Tổng quan kiến trúc

- **App**: `apps/CLB` (package `@ds/web`) — Next 15 + Payload CMS 3, React 19. Image `vierp-clb`,
  subdomain `clb.${BASE_DOMAIN}`, cổng nội bộ 3000 (host map 3014).
- **Design system**: `packages/brand` (`@ds/brand`).
- **DB**: database riêng `clb` trên Postgres self-host (Payload tự quản schema, KHÔNG Prisma).
- **Storage**: MinIO (service `minio`, bucket `clb-media`) — S3-compatible.
- **Auth**: SSO Keycloak (realm `vierp`, client `clb`) cho nhân viên + GIỮ login local + cổng phụ huynh OTP.
- **Đồng bộ**: Payload hook → NATS JetStream (`clb.payment.received`) → Accounting (bút toán doanh thu).

## Các điểm "vênh" đã xử lý

- **pnpm → npm**: bỏ lockfile pnpm; `@ds/brand` đổi `workspace:*` → `*`; npm tự nhận qua `apps/*`,`packages/*`.
- **React 19 / Next 15 vs 18 / 14**: npm giữ React 19 _nested_ trong `apps/CLB/node_modules`,
  root vẫn React 18 — cô lập đúng. Bản Docker dùng `turbo prune` nên chỉ 1 version (sạch tuyệt đối).
- **Cổng dev**: đổi 3005 → **3020** (tránh trùng MRP).

## Chạy local (dev)

```bash
# 1. Cài deps ở gốc ERP (đã gồm CLB)
npm install --legacy-peer-deps

# 2. Tạo DB clb trên Postgres dev
docker exec vierp-postgres createdb -U erp clb   # user/pass xem ERP_DSC/.env

# 3. .env của app: apps/CLB/.env (đã tạo, S3 để trống → media lưu disk local)
#    DATABASE_URI trỏ postgres dev, PAYLOAD_SECRET, NEXT_PUBLIC_SERVER_URL=http://localhost:3020

# 4. Bootstrap schema LẦN ĐẦU bằng push (xem "Migration" bên dưới)
cd apps/CLB && PAYLOAD_DB_PUSH=true npm run dev   # mở http://localhost:3020/admin
```

## ⚠️ Migration / Bootstrap schema (QUAN TRỌNG)

Chuỗi migration của clb (`src/migrations/`) **KHÔNG dựng đủ schema từ DB rỗng** (schema gốc
từng tạo bằng dev `push` trên Supabase trước khi có migration — bảng `classes` v.v. không có
trong migration nào). Vì vậy `payload migrate` trên DB mới sẽ FAIL.

Với DB `clb` MỚI, chọn 1 trong 2:

- **Push bootstrap** (môi trường mới, chưa có dữ liệu): chạy app/migrate 1 lần với
  `PAYLOAD_DB_PUSH=true` → Payload tạo schema ĐẦY ĐỦ từ config. Sau đó tắt (mặc định `false`).
  (`payload.config.ts` đã cho `push` đọc theo env `PAYLOAD_DB_PUSH`.)
- **Dump từ Supabase** (giữ dữ liệu hiện có): `pg_dump` từ Supabase → `pg_restore` vào DB `clb`,
  rồi các migration mới áp lên trên.

## Deploy production (VPS, Docker Compose)

Đã wire sẵn: `docker-compose.prod.yml` (service `minio`, `minio-setup`, `clb` + volume `minio_data`),
`deploy/Caddyfile` (route `clb.` + `minio.`), `deploy/build-images.sh` (row + build-arg),
`deploy/.env.prod.example` (biến `MINIO_*`, `CLB_*`, `BASE_DOMAIN`).

```bash
# 1. Điền .env (xem deploy/.env.prod.example): MINIO_*, CLB_PAYLOAD_SECRET,
#    CLB_PARENT_SESSION_SECRET, CLB_SSO_CLIENT_SECRET, BASE_DOMAIN ...

# 2. Khởi động hạ tầng TRƯỚC (build clb cần postgres reachable)
docker compose -f docker-compose.prod.yml up -d postgres minio nats keycloak

# 3. Tạo DB clb + bootstrap schema
docker exec <postgres> createdb -U $POSTGRES_USER clb
#   build image rồi push schema (xem bước 4-5), hoặc PAYLOAD_DB_PUSH=true lần đầu.

# 4. Build image (build-images.sh tự thêm --network vierp-network + build-arg cho clb)
bash deploy/build-images.sh CLB

# 5. (Lần đầu) bootstrap schema qua container clb với PAYLOAD_DB_PUSH=true, hoặc payload migrate
docker run --rm --network vierp-network -e PAYLOAD_DB_PUSH=true \
  -e DATABASE_URI=postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/clb \
  -e PAYLOAD_SECRET=$CLB_PAYLOAD_SECRET ghcr.io/nclamvn/vierp-clb:latest \
  sh -c "npm run generate:importmap >/dev/null 2>&1; node -e 'require(\"@payloadcms/next\")' || true"
#   (hoặc đơn giản: chạy service clb 1 lần với PAYLOAD_DB_PUSH=true rồi tắt biến đó)

# 6. Lên app + Caddy
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.auth.yml up -d clb
```

### ⚠️ Build-time env (vì có trang SSG đọc CMS)

`next build` của clb khởi tạo Payload để pre-render → **cần `PAYLOAD_SECRET` + `DATABASE_URI`
(DB reachable) lúc build**. `build-images.sh` đã tự truyền các build-arg này cho `vierp-clb`
và build với `--network vierp-network` (nên **postgres phải chạy trước khi build clb**).
Thay thế: đặt các trang frontend đọc CMS thành `export const dynamic = 'force-dynamic'` để build
không cần DB (đánh đổi: mất SSG/ISR cho trang public).

## SSO Keycloak (Pha 3)

- Tạo client `clb` (confidential) trong realm `vierp`; redirect URI `https://clb.<domain>/api/sso/callback`.
- Map vai trò: realm/client role `admin|manager|coach|accountant|receptionist|assistant`
  (hoặc tiền tố `clb-`) → vai trò Payload tương ứng (xem `apps/CLB/src/lib/sso/keycloak.ts`).
- Nhân viên đăng nhập tại **`/api/sso/login`** → callback tự tạo/đồng bộ user Payload → cookie
  `ds-staff-sso` → vào `/admin`. Login local email/mật khẩu VẪN dùng được (fallback).
- Cổng phụ huynh OTP giữ nguyên (tách biệt).
- Biến: `SSO_URL` (nội bộ), `SSO_PUBLIC_URL` (trình duyệt), `SSO_REALM`, `SSO_CLIENT_ID=clb`,
  `SSO_CLIENT_SECRET`, (tùy chọn) `SSO_SESSION_SECRET`.

## Đồng bộ dữ liệu qua NATS (Pha 4)

- Khi tạo phiếu thu học phí (collection `payments`) → hook phát `clb.payment.received` lên
  JetStream (stream `VIERP_CLB`, subjects `clb.>` — tự tạo). No-op nếu thiếu `NATS_URL`.
- Schema + flow trong `@vierp/events`: `schemas/clb.events.ts`, `flows/clb-to-accounting.ts`
  (map học phí → `JournalEntryPosted`: Nợ 1111 / Có 5113/5111/711).
- **Subscriber Accounting (ĐÃ LÀM)**: `apps/Accounting/src/lib/integration/index.ts` thêm
  `subscribeToCLBPaymentEvents()` (subscribe `clb.payment.received` → build `GLJournalEntry`
  Nợ 1111 / Có 5113/5111/711 → `postAutoJournal`). Khởi động qua `apps/Accounting/src/instrumentation.ts`
  (chỉ khi có `NATS_URL`) + `next.config.mjs` (`instrumentationHook` + `transpilePackages`).
  Hạ tầng: thêm stream `VIERP_CLB` vào `ensureStreams()` + mapping `clb`→`VIERP_CLB` trong
  `subscriber.ts` `resolveStreamName()`. **Đã verify end-to-end**: publish `clb.payment.received`
  → consumer `accounting-clb-payment` nhận đúng (smoke test, exit 0).
- **Dọn dẹp kèm theo**: xóa 36 artifact tsc mồ côi (`packages/events/src/*.js`,`*.d.ts`) — stale +
  lỗi (`CRMEventSchemas is not defined`), shadow `.ts` ở runtime Node. Build hiện emit vào `dist/`
  (xem tsconfig), nên `src/*.js` là rác cũ.
- **Lưu ý production**: subscriber persist bút toán ở dạng publish/log (giống MRP/HRM/CRM handler
  hiện có — chưa app nào ghi thẳng DB). Ghi `acc_journal_entries` thật là việc app-wide riêng
  (resolve `accountNumber`→id, đánh số phiếu, kỳ kế toán). Nên **rebuild image Accounting** để
  kiểm chứng `instrumentation` + `transpilePackages` trước khi deploy.
- **Còn lại**: mở rộng `clb.coach.upserted` → HRM, `clb.lead.captured` → CRM (đã có schema).

## Đã kiểm chứng

- ✅ `npm install` (React 19 nested, React 18 root — không ERESOLVE).
- ✅ App boot trong monorepo: `/admin` trả 200 (push schema lên DB `clb`).
- ✅ `@vierp/events` type-check sạch; publish thật `clb.payment.received` lên NATS (stream tạo, persisted).
- ✅ Docker: `generate:importmap` + `turbo prune` (gồm `@ds/brand`) OK; `next build` cần env (đã wire).

## Lưu ý type-check local

Chạy `tsc --noEmit` cho CLB TRONG monorepo (non-pruned) báo ~7 lỗi "type-identity" do hai bản
`@types/react`/`next` cùng tồn tại (React 19 vs 18). Đây là nhiễu do co-location, **KHÔNG** xảy ra
ở bản Docker (pruned, 1 version). Đừng "sửa" bằng cách pin `paths` react/next trong tsconfig
(làm mất `@types/react`, hỏng nặng hơn). File mã mới (sso/_, events/_) đã type-check sạch.
