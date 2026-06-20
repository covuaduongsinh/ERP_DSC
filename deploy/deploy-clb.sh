#!/usr/bin/env bash
# ============================================================
# VietERP — Deploy CLB (Cờ vua Dương Sinh) + hạ tầng, đúng thứ tự đặc thù:
#   1) Lên hạ tầng (postgres, redis, nats, keycloak, minio, minio-setup)
#   2) Tạo database riêng "clb"
#   3) Build image clb (CẦN postgres chạy trước — build có SSG đọc CMS)
#   4) Bootstrap schema LẦN ĐẦU tự động (PAYLOAD_DB_PUSH) nếu DB rỗng
#   5) Lên app clb
#
# Chạy từ THƯ MỤC GỐC repo, sau khi đã điền .env (xem deploy/.env.prod.example):
#   bash deploy/deploy-clb.sh
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ENVFILE=".env"
[[ -f "$ENVFILE" ]] || { echo "Thiếu .env — chạy: cp deploy/.env.prod.example .env && nano .env"; exit 1; }
# shellcheck disable=SC1090
set -a; source "$ENVFILE"; set +a
PGUSER="${POSTGRES_USER:-vierp}"

COMPOSE=(docker compose -f docker-compose.prod.yml -f deploy/docker-compose.auth.yml)

echo "==> [1/5] Hạ tầng: postgres, redis, nats, keycloak, minio, minio-setup"
"${COMPOSE[@]}" up -d postgres redis nats keycloak minio minio-setup

echo "==> [2/5] Chờ Postgres + tạo database 'clb'"
until docker exec vierp-postgres pg_isready -U "$PGUSER" >/dev/null 2>&1; do echo "  ...chờ postgres"; sleep 2; done
docker exec vierp-postgres createdb -U "$PGUSER" clb 2>/dev/null && echo "  DB 'clb' đã tạo" || echo "  DB 'clb' đã tồn tại (bỏ qua)"

echo "==> [3/5] Build image clb (postgres đã chạy nên SSG build đọc được DB)"
bash deploy/build-images.sh CLB

echo "==> [4/5] Kiểm tra schema & bootstrap nếu cần"
HAS_SCHEMA="$(docker exec vierp-postgres psql -U "$PGUSER" -d clb -tAc "SELECT to_regclass('public.users')" 2>/dev/null | tr -d '[:space:]' || true)"
if [[ -z "$HAS_SCHEMA" || "$HAS_SCHEMA" == "null" ]]; then
  echo "  DB rỗng → bootstrap schema bằng PAYLOAD_DB_PUSH=true (chạy 1 lần)"
  CLB_DB_PUSH=true "${COMPOSE[@]}" up -d --force-recreate clb
  echo "  ...chờ Payload tạo schema (tới khi /api/access trả 200)"
  for i in $(seq 1 60); do
    if docker exec vierp-clb sh -c 'curl -fs http://localhost:3000/api/access >/dev/null 2>&1'; then
      echo "  Schema OK"; break
    fi
    sleep 5
  done
  echo "  Tắt push, khởi động lại bình thường"
  CLB_DB_PUSH=false "${COMPOSE[@]}" up -d --force-recreate clb
else
  echo "  Schema đã có → khởi động bình thường"
  "${COMPOSE[@]}" up -d clb
fi

echo "==> [5/5] Xong. Trạng thái:"
"${COMPOSE[@]}" ps clb minio postgres nats keycloak
cat <<'NOTE'

────────────────────────────────────────────────────────────
TIẾP THEO:
  • Caddy (HTTPS): sửa deploy/Caddyfile (đổi erp.example.vn → domain thật + email),
    rồi chạy reverse proxy (xem deploy/CLB-INTEGRATION.md / README.md).
  • SSO Keycloak: tạo realm 'vierp' + client 'clb' (confidential, redirect
    https://clb.<domain>/api/sso/callback) — set CLB_SSO_CLIENT_SECRET trong .env.
  • Kiểm thử: https://clb.<domain>/admin
────────────────────────────────────────────────────────────
NOTE
