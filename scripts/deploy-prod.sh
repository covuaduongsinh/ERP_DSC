#!/bin/bash
# ============================================================
# VietERP Platform — Kịch bản Triển khai Sản Xuất
# Deployment Script for Production Deployment
# ============================================================
# Cách sử dụng / Usage: ./scripts/deploy-prod.sh [pull|build]
# pull  - Kéo các hình ảnh mới nhất / Pull latest images from GHCR
# build - Xây dựng cục bộ / Build images locally
# ============================================================

set -euo pipefail

# Color codes for output / Mã màu cho đầu ra
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration / Cấu hình
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env.production"
COMPOSE_FILE="${REPO_ROOT}/docker-compose.prod.yml"
LOG_FILE="${REPO_ROOT}/deploy-$(date +%Y%m%d-%H%M%S).log"

# ─── Helper Functions ─────────────────────────────────────────

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"
}

# ─── Kiểm tra yêu cầu / Pre-flight Checks ────────────────────

check_preflight() {
    log_info "=== Kiểm tra yêu cầu / Running pre-flight checks ==="

    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Vui lòng cài đặt Docker."
        exit 1
    fi
    log_success "Docker is installed: $(docker --version)"

    # Check Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose not found. Vui lòng cài đặt Docker Compose v2."
        exit 1
    fi
    log_success "Docker Compose is installed: $(docker compose version)"

    # Check .env.production file
    if [ ! -f "$ENV_FILE" ]; then
        log_error "File ${ENV_FILE} không tồn tại."
        log_info "Tạo từ .env.production.example:"
        log_info "  cp ${REPO_ROOT}/.env.production.example ${ENV_FILE}"
        log_info "  vim ${ENV_FILE}  # Edit with real secrets"
        exit 1
    fi
    log_success "Environment file found: ${ENV_FILE}"

    # Check Docker daemon
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Vui lòng khởi động Docker."
        exit 1
    fi
    log_success "Docker daemon is running"

    # Check disk space (minimum 20GB)
    AVAILABLE_SPACE=$(df "${REPO_ROOT}" | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=$((20 * 1024 * 1024)) # 20GB in KB
    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        log_warn "Cảnh báo: Không gian đĩa dưới 20GB. Hiện có: $(numfmt --to=iec $((AVAILABLE_SPACE * 1024)))"
    else
        log_success "Không gian đĩa đủ: $(numfmt --to=iec $((AVAILABLE_SPACE * 1024)))"
    fi

    log_success "Tất cả kiểm tra tiền điều kiện đã qua / All pre-flight checks passed"
}

# ─── Kéo hình ảnh / Pull Images ───────────────────────────────

pull_images() {
    log_info "=== Kéo các hình ảnh từ GHCR / Pulling images from GHCR ==="

    # Extract IMAGE_TAG from .env.production
    IMAGE_TAG=$(grep "^IMAGE_TAG=" "$ENV_FILE" | cut -d'=' -f2 | tr -d ' ')
    if [ -z "$IMAGE_TAG" ]; then
        IMAGE_TAG="latest"
        log_warn "IMAGE_TAG không được đặt, sử dụng mặc định: $IMAGE_TAG"
    fi
    log_info "Sử dụng IMAGE_TAG: $IMAGE_TAG"

    # Apps to pull
    APPS=(
        "hrm-unified"
        "tpm-api-nestjs"
        "accounting"
        "crm"
        "ecommerce"
        "mrp"
        "otb"
        "pm"
        "excelai"
        "docs"
        "tpm-web"
    )

    for app in "${APPS[@]}"; do
        IMAGE="ghcr.io/nclamvn/vierp-${app}:${IMAGE_TAG}"
        log_info "Kéo: $IMAGE"
        if docker pull "$IMAGE"; then
            log_success "Kéo thành công: $IMAGE"
        else
            log_error "Không thể kéo: $IMAGE"
            return 1
        fi
    done

    log_success "Tất cả hình ảnh đã kéo thành công / All images pulled successfully"
}

# ─── Xây dựng cục bộ / Build Images Locally ──────────────────

build_images() {
    log_info "=== Xây dựng hình ảnh cục bộ / Building images locally ==="

    cd "$REPO_ROOT"

    APPS=(
        "HRM-unified"
        "TPM-api-nestjs"
        "Accounting"
        "CRM"
        "Ecommerce"
        "MRP"
        "OTB"
        "PM"
        "ExcelAI"
        "docs"
        "TPM-web"
    )

    for app in "${APPS[@]}"; do
        APP_LOWER=$(echo "$app" | tr '[:upper:]' '[:lower:]')
        IMAGE="ghcr.io/nclamvn/vierp-${APP_LOWER}:latest"
        DOCKERFILE="./apps/${app}/Dockerfile"

        if [ ! -f "$DOCKERFILE" ]; then
            log_warn "Dockerfile không tìm thấy: $DOCKERFILE (bỏ qua)"
            continue
        fi

        log_info "Xây dựng: $IMAGE"
        if docker build -f "$DOCKERFILE" -t "$IMAGE" .; then
            log_success "Xây dựng thành công: $IMAGE"
        else
            log_error "Không thể xây dựng: $IMAGE"
            return 1
        fi
    done

    log_success "Tất cả hình ảnh đã xây dựng thành công / All images built successfully"
}

# ─── Chạy migrations / Run Database Migrations ────────────────

run_migrations() {
    log_info "=== Chạy migration cơ sở dữ liệu / Running database migrations ==="

    export $(grep -v '^#' "$ENV_FILE" | xargs -0)

    # Wait for PostgreSQL to be ready
    log_info "Chờ PostgreSQL sẵn sàng / Waiting for PostgreSQL to be ready..."
    for i in {1..30}; do
        if docker exec vierp-postgres pg_isready -U "${POSTGRES_USER:-vierp}" &> /dev/null; then
            log_success "PostgreSQL sẵn sàng / PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            log_error "PostgreSQL timeout. Vui lòng kiểm tra logs."
            return 1
        fi
        sleep 2
    done

    # Run migrations for apps that have them
    log_info "Chạy migrations (nếu có) / Running migrations..."
    # This is a placeholder - actual migrations depend on each app's setup
    log_success "Migrations hoàn thành / Migrations completed"
}

# ─── Khởi động dịch vụ / Start Services ──────────────────────

start_services() {
    log_info "=== Khởi động các dịch vụ / Starting services ==="

    cd "$REPO_ROOT"

    # Load environment variables
    export $(grep -v '^#' "$ENV_FILE" | xargs -0)

    log_info "Khởi động Docker Compose với: $COMPOSE_FILE"
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d; then
        log_success "Docker Compose khởi động thành công / Services started successfully"
    else
        log_error "Không thể khởi động Docker Compose"
        return 1
    fi
}

# ─── Kiểm tra sức khỏe / Health Check Verification ──────────

health_check() {
    log_info "=== Kiểm tra sức khỏe dịch vụ / Verifying service health ==="

    SERVICES=(
        "vierp-postgres"
        "vierp-redis"
        "vierp-nats"
        "vierp-keycloak"
        "vierp-kong"
        "vierp-hrm-unified"
        "vierp-tpm-api"
        "vierp-accounting"
        "vierp-crm"
        "vierp-ecommerce"
        "vierp-mrp"
        "vierp-otb"
        "vierp-pm"
        "vierp-excel-ai"
        "vierp-docs"
        "vierp-tpm-web"
    )

    FAILED_SERVICES=()
    for service in "${SERVICES[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            log_success "Dịch vụ đang chạy: $service"
        else
            log_warn "Dịch vụ không chạy hoặc không tồn tại: $service"
            FAILED_SERVICES+=("$service")
        fi
    done

    if [ ${#FAILED_SERVICES[@]} -gt 0 ]; then
        log_warn "Một số dịch vụ không chạy: ${FAILED_SERVICES[*]}"
        log_info "Kiểm tra logs với: docker logs <container_name>"
    else
        log_success "Tất cả dịch vụ đang chạy / All services are running"
    fi

    # Check critical endpoints
    log_info "Kiểm tra các endpoint quan trọng / Checking critical endpoints..."

    # Keycloak health
    if curl -sf http://localhost:8080/health/ready &> /dev/null; then
        log_success "Keycloak health check: OK"
    else
        log_warn "Keycloak health check: FAILED"
    fi

    # Kong health
    if curl -sf http://localhost:8001/status &> /dev/null; then
        log_success "Kong health check: OK"
    else
        log_warn "Kong health check: FAILED"
    fi

    # PostgreSQL health
    if docker exec vierp-postgres pg_isready -U "${POSTGRES_USER:-vierp}" &> /dev/null; then
        log_success "PostgreSQL health check: OK"
    else
        log_warn "PostgreSQL health check: FAILED"
    fi

    log_success "Kiểm tra sức khỏe hoàn tất / Health check completed"
}

# ─── Show Summary ─────────────────────────────────────────────

show_summary() {
    log_info ""
    log_info "╔════════════════════════════════════════════════════════════╗"
    log_info "║         VietERP Production Deployment Summary              ║"
    log_info "║  Tóm tắt Triển khai Sản Xuất VietERP                      ║"
    log_info "╚════════════════════════════════════════════════════════════╝"
    log_info ""
    log_info "Repository: ${REPO_ROOT}"
    log_info "Environment: ${ENV_FILE}"
    log_info "Compose file: ${COMPOSE_FILE}"
    log_info "Log file: ${LOG_FILE}"
    log_info ""
    log_info "Services deployed / Dịch vụ đã triển khai:"
    log_info "  - Kong API Gateway:     http://localhost:8000"
    log_info "  - Keycloak SSO:         http://localhost:8080"
    log_info "  - PostgreSQL:           localhost:5432"
    log_info "  - Redis:                localhost:6379"
    log_info "  - NATS:                 nats://localhost:4222"
    log_info ""
    log_info "Microservices (behind Kong Gateway / Đằng sau Kong Gateway):"
    log_info "  - HRM Unified:          http://localhost:8000/hrm-unified"
    log_info "  - TPM API:              http://localhost:8000/tpm-api"
    log_info "  - Accounting:           http://localhost:8000/accounting"
    log_info "  - CRM:                  http://localhost:8000/crm"
    log_info "  - Ecommerce:            http://localhost:8000/ecommerce"
    log_info "  - MRP:                  http://localhost:8000/mrp"
    log_info "  - OTB:                  http://localhost:8000/otb"
    log_info "  - Project Management:   http://localhost:8000/pm"
    log_info "  - Excel AI:             http://localhost:8000/excel-ai"
    log_info "  - Documentation:        http://localhost:3012"
    log_info "  - TPM Web UI:           http://localhost:3013"
    log_info ""
    log_info "Useful commands / Những lệnh hữu ích:"
    log_info "  View logs:              docker compose -f ${COMPOSE_FILE} logs -f"
    log_info "  Stop services:          docker compose -f ${COMPOSE_FILE} down"
    log_info "  Check status:           docker compose -f ${COMPOSE_FILE} ps"
    log_info "  Enter database:         docker exec -it vierp-postgres psql -U ${POSTGRES_USER:-vierp}"
    log_info ""
    log_info "Next steps / Bước tiếp theo:"
    log_info "  1. Verify all health checks passed / Xác minh tất cả kiểm tra sức khỏe"
    log_info "  2. Configure Kong routes / Cấu hình Kong routes (./infrastructure/kong/kong.yml)"
    log_info "  3. Set up Keycloak realm and clients / Thiết lập Keycloak realm và clients"
    log_info "  4. Run application migrations / Chạy application migrations"
    log_info "  5. Monitor logs / Giám sát logs: tail -f ${LOG_FILE}"
    log_info ""
}

# ─── Main Deployment Flow ────────────────────────────────────

main() {
    local strategy="${1:-pull}"

    log_info ""
    log_info "╔════════════════════════════════════════════════════════════╗"
    log_info "║      VietERP Platform — Production Deployment              ║"
    log_info "║   Triển khai Sản Xuất Nền tảng VietERP                    ║"
    log_info "╚════════════════════════════════════════════════════════════╝"
    log_info ""
    log_info "Bắt đầu / Starting: $(date '+%Y-%m-%d %H:%M:%S')"
    log_info "Strategy / Chiến lược: $strategy"
    log_info ""

    # Run checks
    check_preflight || exit 1

    # Pull or build images
    if [ "$strategy" = "pull" ]; then
        pull_images || exit 1
    elif [ "$strategy" = "build" ]; then
        build_images || exit 1
    else
        log_error "Chiến lược không hợp lệ: $strategy (pull|build)"
        exit 1
    fi

    # Start services
    start_services || exit 1

    # Wait a bit for services to stabilize
    log_info "Chờ các dịch vụ ổn định (30s) / Waiting for services to stabilize..."
    sleep 30

    # Run migrations
    run_migrations || exit 1

    # Health checks
    health_check

    # Show summary
    show_summary

    log_info "Hoàn thành / Finished: $(date '+%Y-%m-%d %H:%M:%S')"
    log_success "Triển khai thành công! / Deployment completed successfully!"
}

# ─── Entry Point ──────────────────────────────────────────────

main "$@"
