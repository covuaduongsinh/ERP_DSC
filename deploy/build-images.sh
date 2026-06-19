#!/usr/bin/env bash
# ============================================================
# VietERP — Build image LOCAL từ monorepo, tag đúng tên mà
# docker-compose.prod.yml mong đợi (ghcr.io/nclamvn/vierp-*).
# Docker dùng image local nếu đã có => compose KHÔNG pull từ GHCR.
#
# Dùng 1 Dockerfile universal (turbo prune): infrastructure/docker/Dockerfile.turbo
#
# Chạy từ THƯ MỤC GỐC repo:
#   bash deploy/build-images.sh            # build tất cả (tuần tự)
#   bash deploy/build-images.sh CRM HRM    # build vài app theo TÊN THƯ MỤC
# ============================================================
set -euo pipefail

IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKERFILE="infrastructure/docker/Dockerfile.turbo"

# Đọc các biến NEXT_PUBLIC_* (vd Supabase) từ .env để truyền LÚC BUILD (Next nhúng vào client).
ENVFILE="${ENVFILE:-.env}"
read_env() { grep -E "^$1=" "$ENVFILE" 2>/dev/null | head -1 | cut -d= -f2-; }
SUPA_URL="$(read_env NEXT_PUBLIC_SUPABASE_URL)"
SUPA_KEY="$(read_env NEXT_PUBLIC_SUPABASE_ANON_KEY)"

# CoVua (Payload CMS) cần secret + DB lúc BUILD (có trang SSG đọc CMS).
PG_USER="$(read_env POSTGRES_USER)"; PG_USER="${PG_USER:-vierp}"
PG_PASS="$(read_env POSTGRES_PASSWORD)"
COVUA_SECRET="$(read_env COVUA_PAYLOAD_SECRET)"
BASE_DOMAIN="$(read_env BASE_DOMAIN)"; BASE_DOMAIN="${BASE_DOMAIN:-erp.example.vn}"

# DIR(thư mục apps/) | PKG(name trong package.json) | IMG(tên image compose)
ROWS=(
  "HRM-AI|vierp-hrm-ai|vierp-hrm-ai"
  "HRM-unified|erp-hrm|vierp-hrm-unified"
  "HRM|vierp-hrm|vierp-hrm"
  "Accounting|erp-accounting|vierp-accounting"
  "CRM|crm|vierp-crm"
  "Ecommerce|erp-ecommerce|vierp-ecommerce"
  "MRP|vierp-mrp|vierp-mrp"
  "OTB|vierp-otb-nextjs|vierp-otb"
  "PM|vierp-pm|vierp-pm"
  "ExcelAI|excel-claude-code|vierp-excelai"
  "docs|erp-docs|vierp-docs"
  "TPM-api-nestjs|vierp-tpm-api|vierp-tpm-api-nestjs"
  "TPM-web|@vierp/tpm-web|vierp-tpm-web"
  "CoVua|@ds/web|vierp-covua"
)

build_row() {
  local dir="$1" pkg="$2" img="$3"
  echo "==> [$dir] PKG=$pkg  ->  ghcr.io/nclamvn/$img:$IMAGE_TAG"
  local extra=()
  # CoVua build cần PAYLOAD_SECRET + DATABASE_URI (DB phải REACHABLE) + URL gốc.
  # `--network vierp-network` để build container gọi được `postgres:5432`
  # ⇒ PHẢI khởi động postgres TRƯỚC khi build covua.
  if [[ "$img" == "vierp-covua" ]]; then
    extra+=( --network vierp-network )
    extra+=( --build-arg "PAYLOAD_SECRET=${COVUA_SECRET}" )
    extra+=( --build-arg "DATABASE_URI=postgresql://${PG_USER}:${PG_PASS}@postgres:5432/covua" )
    extra+=( --build-arg "NEXT_PUBLIC_SERVER_URL=https://covua.${BASE_DOMAIN}" )
  fi
  docker build -f "$DOCKERFILE" --build-arg PKG="$pkg" \
    --build-arg NEXT_PUBLIC_SUPABASE_URL="$SUPA_URL" \
    --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPA_KEY" \
    "${extra[@]}" \
    -t "ghcr.io/nclamvn/$img:$IMAGE_TAG" .
}

want=("$@")
for row in "${ROWS[@]}"; do
  IFS='|' read -r dir pkg img <<< "$row"
  if [[ ${#want[@]} -gt 0 ]]; then
    printf '%s\n' "${want[@]}" | grep -qx "$dir" || continue
  fi
  build_row "$dir" "$pkg" "$img"   # tuần tự để tránh OOM trên 16GB
done

cat <<'NOTE'

────────────────────────────────────────────────────────────
GHI CHÚ per-app (kiểm khi chạy thật):
  • Accounting `start` hardcode `-p 3007`; MRP/Next khác nghe PORT=3000.
    Nếu app nghe sai cổng -> override CMD/PORT trong compose cho app đó.
  • MRP: start = `node dist/server.js` (server socket.io tự viết) — universal Dockerfile xử lý OK
    vì giữ full node_modules + chạy `npm start`.
  • TPM-api-nestjs: NestJS (`node dist/main`) — cũng chạy qua `npm start`, OK.
  • App workspace-coupled (Accounting/Ecommerce/docs dùng @vierp/*): turbo build sẽ build deps trước
    (^build). Nếu packages/* thiếu script build mà cần biên dịch -> xử lý riêng package đó.
  • Migrations: image giữ full node_modules nên chạy được:
       docker run --rm --network vierp-network -e DATABASE_URL=... <img> npx prisma db push
────────────────────────────────────────────────────────────
NOTE
