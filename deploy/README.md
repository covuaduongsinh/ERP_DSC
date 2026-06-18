# Triển khai VietERP lên VPS Hetzner — Runbook

Dành cho **Công ty CP Cờ vua Dương Sinh**. VPS khuyến nghị: **Hetzner CAX31** (ARM64, 8 vCPU / 16 GB
/ 160 GB NVMe, ~€12.49/tháng). Mô hình: **full-stack monorepo** theo
[docker-compose.prod.yml](../docker-compose.prod.yml), build image **ngay từ monorepo này**.

## ✅ Trạng thái build-readiness (đã kiểm chứng bằng `docker build` thật)

- **Build từ monorepo CHẠY ĐƯỢC** qua 1 Dockerfile universal: [infrastructure/docker/Dockerfile.turbo](../infrastructure/docker/Dockerfile.turbo)
  (dùng `turbo prune` + giữ `node_modules` + chạy `npm start` của từng app).
- Đã build thành công 2 app đại diện cho 2 lớp:
  - **CRM** (self-contained Next) ✅
  - **Accounting** (workspace-coupled, dùng `@vierp/*`) ✅
- **3 fix nhỏ ở shared packages đã áp dụng** (gỡ luôn cho Ecommerce/docs cùng lớp):
  1. [packages/database/package.json](../packages/database/package.json): `build` thêm `prisma generate` (PrismaClient là code sinh ra).
  2. [packages/auth/tsconfig.json](../packages/auth/tsconfig.json): `lib` thêm `"DOM"` (code client dùng `sessionStorage`/`fetch`).
  3. [packages/master-data](../packages/master-data): `tsconfig` tắt `declaration` + vài ép kiểu `request.json()`.
- **Phát hiện gốc**: `package-lock.json` của monorepo **lệch** với package.json ⇒ `npm ci` fail.
  Dockerfile.turbo dùng `npm install --legacy-peer-deps` để dung sai (đánh đổi: kém reproducible).

> Chưa verify từng app còn lại (HRM, MRP, HRM-AI, OTB, PM, ExcelAI, TPM-\*). Universal Dockerfile được
> thiết kế cho chúng, nhưng vài app có lưu ý code riêng (xem **Caveat**) — "hoàn thiện dần" theo từng app.

## File trong thư mục này

| File                      | Việc                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `setup-vps.sh`            | Bootstrap VPS: Docker + swap 6G + ufw + timezone                 |
| `.env.prod.example`       | Mẫu biến môi trường cho `docker-compose.prod.yml`                |
| `build-images.sh`         | Build image từ monorepo (Dockerfile.turbo), tag đúng tên compose |
| `docker-compose.auth.yml` | Override bù `NEXTAUTH_SECRET`/`NEXTAUTH_URL` còn thiếu           |
| `Caddyfile`               | Reverse proxy + auto HTTPS, mỗi module 1 subdomain               |

## Các bước

### 1. Tạo server (Hetzner Console)

- Type **CAX31**, image **Ubuntu 24.04**, thêm SSH key, **bật Backups** (+20%).
- Trỏ DNS A record cho từng subdomain (`hrm.`, `ketoan.`, `crm.`, `mrp.`, `pm.`, `sso.`, `api.`…) về IP server.

### 2. Bootstrap hệ điều hành

```bash
ssh root@<IP>
bash setup-vps.sh        # Docker + swap 6G + ufw (mở 22/80/443)
```

### 3. Lấy mã nguồn + cấu hình

```bash
git clone <repo-url> /opt/vierp && cd /opt/vierp
cp deploy/.env.prod.example .env
nano .env   # POSTGRES_PASSWORD, KEYCLOAK_ADMIN_PASSWORD, NEXTAUTH_SECRET, AUTH_SECRET,
            # BASE_DOMAIN, ANTHROPIC_API_KEY ...
```

### 4. Build image (từ THƯ MỤC GỐC repo)

```bash
bash deploy/build-images.sh              # build tất cả (tuần tự, tránh OOM)
# hoặc vài app theo tên thư mục:
bash deploy/build-images.sh CRM Accounting HRM PM
```

> Mỗi image ~1.6–1.8GB (universal giữ full node_modules). 13 app ≈ 20GB+ — CAX31 160GB vẫn dư.
> Build cả bộ mất nhiều phút; swap 6G giúp tránh OOM.

### 5. Hạ tầng + DB rồi chạy

```bash
docker compose -f docker-compose.prod.yml up -d postgres redis nats keycloak kong
# Migrations (image giữ full node_modules nên chạy prisma được):
docker run --rm --network vierp-network -e DATABASE_URL=... <image> npx prisma db push
# Chạy app (kèm override bù NextAuth secret/URL):
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.auth.yml up -d
```

### 6. Reverse proxy + HTTPS (Caddy)

- Sửa `deploy/Caddyfile`: thay `erp.example.vn` bằng tên miền thật + email ACME.
- Chạy Caddy nối vào `vierp-network` để gọi thẳng `<service>:3000`:

```bash
docker run -d --name caddy --restart unless-stopped \
  --network vierp-network -p 80:80 -p 443:443 \
  -v /opt/vierp/deploy/Caddyfile:/etc/caddy/Caddyfile:ro \
  -v caddy_data:/data -v caddy_config:/config caddy:2
```

### 7. Kiểm thử

- `docker compose -f docker-compose.prod.yml ps` → tất cả `healthy`.
- `curl -f http://localhost:3005/api/health` (Accounting), `:3006` (CRM)…
- Mở `https://crm.<domain>` đăng nhập; `docker stats` → tổng RAM còn đệm trên 16GB.

---

## ⚠️ Caveat còn lại (xử lý dần khi build từng app)

1. **Lockfile lệch**: đã né bằng `npm install` trong Dockerfile. Muốn reproducible: chạy
   `npm install --legacy-peer-deps` ở gốc repo rồi commit `package-lock.json` đã đồng bộ.
2. **Cổng app**: vài app hardcode cổng trong `start` (vd Accounting `next start -p 3007`,
   MRP `node dist/server.js`). Nếu container nghe sai cổng 3000 → override `command`/`PORT` cho app đó trong compose.
3. **HRM-AI / HRM-unified**: theo ghi nhớ vận hành ([[vierp-run-gotchas]]) còn lỗi code khi build/run:
   thư mục `app/` thừa che `src/app/` và `require('@prismy/sso')` → cần commit các bản vá đó trước.
4. **TPM-api-nestjs**: NestJS (`node dist/main`) — universal Dockerfile xử lý qua `npm start`, nhưng chưa verify.
5. **App workspace-coupled khác** (Ecommerce/docs): cùng lớp Accounting, kỳ vọng OK nhờ 3 fix trên — verify khi build.
6. **packageManager noise**: log build có `"packageManager": "yarn@npm@..."` — cảnh báo cosmetic của Next, không chặn build.
7. **NextAuth**: `docker-compose.prod.yml` gốc không truyền secret/URL → đã bù bằng `deploy/docker-compose.auth.yml`
   (cần `NEXTAUTH_SECRET`, `AUTH_SECRET`, `BASE_DOMAIN` trong `.env`).
8. **Prisma/DB**: app dùng `@prisma/adapter-pg` (HRM) bỏ qua `?schema=` → cần **database riêng**; app `@prisma/client` v5 dùng `?schema=<app>` trên DB chung.
