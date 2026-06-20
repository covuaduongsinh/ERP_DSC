# VietERP Platform — Kế hoạch Triển khai Chi tiết / Detailed Upgrade Plan

> Tài liệu kỹ thuật dành cho đội phát triển | Phiên bản 2.0 | 2026-03-28

## Mục lục

1. [Kiến trúc Mục tiêu](#1-kiến-trúc-mục-tiêu)
2. [Phase 1: Testing & CI/CD](#2-phase-1-testing--cicd)
3. [Phase 2: API & Observability](#3-phase-2-api--observability)
4. [Phase 3: Production Infrastructure](#4-phase-3-production-infrastructure)
5. [Phase 4: Module Enhancements](#5-phase-4-module-enhancements)
6. [Phase 5: Documentation & Community](#6-phase-5-documentation--community)
7. [Risk Management](#7-risk-management)

---

## 1. Kiến trúc Mục tiêu / Target Architecture

### Hiện tại (v1.0)

```
Client → Kong Gateway → Next.js Apps (14) → PostgreSQL
                                           → Redis
                                           → NATS JetStream
                        Keycloak SSO ←──────┘
```

### Mục tiêu (v2.0)

```
Client → Kong Gateway → Next.js Apps (14) → PostgreSQL 16
              │                             → Redis 7 (cache + rate-limit)
              │                             → NATS JetStream (events)
              │                             → Meilisearch (global search)
              │         Keycloak SSO ←──────┘
              │
              ├── Prometheus ← metrics endpoints (mỗi app)
              ├── Grafana ← dashboards (5)
              ├── Sentry/GlitchTip ← error tracking
              └── Loki ← centralized logs
```

### Package mới cần tạo

| Package             | Mục đích                       | Dependencies                     |
| ------------------- | ------------------------------ | -------------------------------- |
| `@vierp/metrics`    | Prometheus metrics cho mọi app | prom-client                      |
| `@vierp/rate-limit` | Redis-backed rate limiting     | ioredis, rate-limiter-flexible   |
| `@vierp/openapi`    | Auto-generate OpenAPI specs    | zod-to-openapi, swagger-ui-react |

---

## 2. Phase 1: Testing & CI/CD (Tuần 1–3)

### 2.1 E2E Tests — Accounting Module

**File mới**: `apps/Accounting/e2e/`

```
apps/Accounting/
├── e2e/
│   ├── chart-of-accounts.spec.ts   # CRUD tài khoản kế toán
│   ├── journal-entries.spec.ts      # Bút toán nhật ký
│   ├── invoices.spec.ts             # Hoá đơn bán hàng / mua hàng
│   ├── tax-declarations.spec.ts     # Kê khai thuế GTGT
│   ├── bank-reconciliation.spec.ts  # Đối soát ngân hàng
│   ├── ap-ar.spec.ts                # Công nợ phải thu / phải trả
│   ├── budget.spec.ts               # Quản lý ngân sách
│   └── e-invoice.spec.ts            # Hoá đơn điện tử
├── playwright.config.ts
└── fixtures/
    └── accounting-data.ts           # Test data factory
```

**Kịch bản test mẫu** — `chart-of-accounts.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Hệ thống tài khoản / Chart of Accounts", () => {
  test("tạo tài khoản cấp 1 theo TT200", async ({ page }) => {
    await page.goto("/accounting/chart-of-accounts");
    await page.click('[data-testid="btn-add-account"]');
    await page.fill('[name="accountCode"]', "111");
    await page.fill('[name="accountName"]', "Tiền mặt");
    await page.selectOption('[name="accountType"]', "ASSET");
    await page.click('[data-testid="btn-save"]');
    await expect(page.locator("text=111 - Tiền mặt")).toBeVisible();
  });

  test("không cho phép mã tài khoản trùng", async ({ page }) => {
    // ...
  });

  test("hiển thị cây tài khoản đúng cấu trúc", async ({ page }) => {
    // ...
  });
});
```

### 2.2 E2E Tests — Ecommerce Module

**File mới**: `apps/Ecommerce/e2e/`

```
apps/Ecommerce/
├── e2e/
│   ├── products.spec.ts      # Quản lý sản phẩm
│   ├── orders.spec.ts        # Quy trình đặt hàng
│   ├── cart.spec.ts           # Giỏ hàng
│   ├── checkout.spec.ts       # Thanh toán (VNPay, MoMo)
│   ├── payments.spec.ts       # Xác nhận thanh toán
│   └── shipping.spec.ts       # Vận chuyển (GHN, GHTK)
├── playwright.config.ts
└── fixtures/
    └── ecommerce-data.ts
```

### 2.3 Shared Package Tests

**Mục tiêu**: Mỗi package ≥80% coverage

| Package              | Test files cần tạo                                 | Ưu tiên |
| -------------------- | -------------------------------------------------- | ------- |
| `packages/auth/`     | auth.test.ts, rbac.test.ts, jwt.test.ts            | P0      |
| `packages/events/`   | publisher.test.ts, subscriber.test.ts, dlq.test.ts | P0      |
| `packages/cache/`    | cache.test.ts, invalidation.test.ts                | P0      |
| `packages/database/` | client.test.ts, migrations.test.ts                 | P0      |
| `packages/security/` | encryption.test.ts, sanitize.test.ts               | P0      |
| `packages/branding/` | config.test.ts, i18n.test.ts                       | P1      |
| `packages/health/`   | health-check.test.ts                               | P1      |
| `packages/logger/`   | logger.test.ts, correlation.test.ts                | P1      |

### 2.4 CI/CD Nâng cấp

**File sửa**: `.github/workflows/ci.yml`

```yaml
# Thêm vào ci.yml hiện tại:

coverage:
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "20" }
    - run: npm ci --legacy-peer-deps
    - run: npx turbo test -- --coverage --reporter=json
    - uses: codecov/codecov-action@v4
      with:
        token: ${{ secrets.CODECOV_TOKEN }}
        fail_ci_if_error: true
        # Ngưỡng tối thiểu / Minimum threshold
        flags: unittests

security-audit:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: npm audit --audit-level=critical
    - uses: aquasecurity/trivy-action@master
      with:
        scan-type: "fs"
        severity: "CRITICAL,HIGH"

docker-build:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      app: [HRM-unified, TPM-api-nestjs]
  steps:
    - uses: actions/checkout@v4
    - run: docker build -f apps/${{ matrix.app }}/Dockerfile -t vierp/${{ matrix.app }}:test .
```

**File mới**: `.github/workflows/release.yml`

```yaml
name: Release
on:
  push:
    tags: ["v*"]
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v4
      - run: npx turbo build
      - uses: softprops/action-gh-release@v2
        with:
          generate_release_notes: true
```

### 2.5 Developer Experience

**File mới**: `scripts/setup.sh`

```bash
#!/bin/bash
set -e
echo "🚀 VietERP — Thiết lập môi trường phát triển"

# Kiểm tra prerequisites
command -v node >/dev/null || { echo "❌ Node.js chưa cài"; exit 1; }
command -v docker >/dev/null || { echo "❌ Docker chưa cài"; exit 1; }

# Cài đặt dependencies
npm install --legacy-peer-deps

# Khởi động hạ tầng
docker compose up -d
sleep 5

# Thiết lập database
cp -n .env.example .env
npx turbo db:generate
npx turbo db:push
npx turbo db:seed

echo "✅ Sẵn sàng! Chạy: npx turbo dev --concurrency=25"
```

**File mới**: `Makefile`

```makefile
.PHONY: dev test build setup clean

setup:       ## Thiết lập môi trường
	bash scripts/setup.sh

dev:         ## Chạy development servers
	npx turbo dev --concurrency=25

test:        ## Chạy tất cả tests
	npx turbo test

test-e2e:    ## Chạy E2E tests
	npx turbo test:e2e

build:       ## Build toàn bộ
	npx turbo build

lint:        ## Kiểm tra lint + typecheck
	npx turbo lint && npx turbo typecheck

clean:       ## Dọn dẹp
	rm -rf node_modules apps/*/node_modules apps/*/.next apps/*/dist

docker-up:   ## Khởi động hạ tầng Docker
	docker compose up -d

docker-down: ## Tắt hạ tầng Docker
	docker compose down
```

**File mới**: `.husky/pre-commit`

```bash
#!/bin/sh
npx lint-staged
```

**File mới**: `.lintstagedrc.json`

```json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml}": ["prettier --write"]
}
```

---

## 3. Phase 2: API & Observability (Tuần 4–6)

### 3.1 Package @vierp/openapi

**File mới**: `packages/openapi/`

```
packages/openapi/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts           # Main exports
    ├── generator.ts       # Scan API routes → OpenAPI spec
    ├── swagger-ui.tsx     # React component cho Swagger UI
    └── postman.ts         # Export Postman collection
```

**Tích hợp vào mỗi app** — thêm route `/api/docs`:

```typescript
// apps/CRM/app/api/docs/route.ts
import { generateOpenAPISpec } from "@vierp/openapi";
import { NextResponse } from "next/server";

export async function GET() {
  const spec = await generateOpenAPISpec({
    title: "VietERP CRM API",
    version: "1.0.0",
    basePath: "/api",
  });
  return NextResponse.json(spec);
}
```

### 3.2 Package @vierp/metrics

**File mới**: `packages/metrics/`

```typescript
// packages/metrics/src/index.ts
import {
  Registry,
  Counter,
  Histogram,
  collectDefaultMetrics,
} from "prom-client";

const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: "vierp_http_request_duration_seconds",
  help: "Thời gian xử lý HTTP request",
  labelNames: ["method", "route", "status_code", "app"],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [registry],
});

export const httpRequestTotal = new Counter({
  name: "vierp_http_requests_total",
  help: "Tổng số HTTP requests",
  labelNames: ["method", "route", "status_code", "app"],
  registers: [registry],
});

export const dbQueryDuration = new Histogram({
  name: "vierp_db_query_duration_seconds",
  help: "Thời gian truy vấn database",
  labelNames: ["operation", "model", "app"],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [registry],
});

export { registry };
```

**Tích hợp** — thêm route `/api/metrics` vào mỗi app:

```typescript
// middleware pattern cho Next.js apps
import { httpRequestDuration, httpRequestTotal } from "@vierp/metrics";

export function withMetrics(handler) {
  return async (req, res) => {
    const end = httpRequestDuration.startTimer();
    const result = await handler(req, res);
    end({ method: req.method, route: req.url, status_code: res.statusCode });
    httpRequestTotal.inc({
      method: req.method,
      route: req.url,
      status_code: res.statusCode,
    });
    return result;
  };
}
```

### 3.3 Grafana Dashboards

**File mới**: `infrastructure/monitoring/`

```
infrastructure/monitoring/
├── docker-compose.monitoring.yml
├── prometheus/
│   ├── prometheus.yml          # Scrape config cho tất cả apps
│   └── alerts/
│       ├── app-alerts.yml      # Error rate, latency alerts
│       └── infra-alerts.yml    # Disk, memory, CPU alerts
├── grafana/
│   ├── provisioning/
│   │   ├── datasources.yml    # Prometheus + Loki datasources
│   │   └── dashboards.yml
│   └── dashboards/
│       ├── overview.json       # Tổng quan hệ thống
│       ├── per-app.json        # Chi tiết từng app
│       ├── database.json       # PostgreSQL metrics
│       ├── nats.json           # NATS JetStream metrics
│       └── business.json       # Business KPIs
└── loki/
    └── loki-config.yml
```

**Docker Compose monitoring**:

```yaml
# infrastructure/monitoring/docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:v2.51.0
    volumes:
      - ./prometheus:/etc/prometheus
      - prometheus_data:/prometheus
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana:10.4.0
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    ports: ["3000:3000"]
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin

  loki:
    image: grafana/loki:2.9.0
    volumes:
      - ./loki:/etc/loki
    ports: ["3100:3100"]
```

---

## 4. Phase 3: Production Infrastructure (Tuần 7–9)

### 4.1 Dockerfile Chuẩn — Multi-stage Build

**Template cho Next.js apps**:

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json turbo.json ./
COPY apps/APP_NAME/package.json ./apps/APP_NAME/
COPY packages/*/package.json ./packages/
RUN npm ci --legacy-peer-deps --production=false

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx turbo build --filter=APP_NAME

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/apps/APP_NAME/.next/standalone ./
COPY --from=builder /app/apps/APP_NAME/.next/static ./.next/static
COPY --from=builder /app/apps/APP_NAME/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

### 4.2 Helm Chart

**File mới**: `charts/vierp/`

```
charts/vierp/
├── Chart.yaml
├── values.yaml              # Default values
├── values-staging.yaml      # Staging overrides
├── values-production.yaml   # Production overrides
└── templates/
    ├── _helpers.tpl
    ├── deployment.yaml      # App deployments
    ├── service.yaml         # K8s services
    ├── ingress.yaml         # Ingress rules
    ├── hpa.yaml             # Horizontal Pod Autoscaler
    ├── configmap.yaml       # App configuration
    ├── secret.yaml          # Sensitive config
    ├── migration-job.yaml   # Prisma migration job
    └── tests/
        └── connection.yaml  # Helm test
```

**values.yaml mẫu**:

```yaml
global:
  domain: vierp.example.com
  imageRegistry: ghcr.io/nclamvn
  imageTag: latest

apps:
  hrm-unified:
    enabled: true
    replicas: 2
    port: 3003
    resources:
      requests: { cpu: 100m, memory: 256Mi }
      limits: { cpu: 500m, memory: 512Mi }
    hpa:
      minReplicas: 2
      maxReplicas: 10
      targetCPU: 70

  crm:
    enabled: true
    replicas: 2
    port: 3018
    # ...

postgresql:
  enabled: true
  auth:
    database: vierp
    username: vierp
  primary:
    persistence:
      size: 50Gi

redis:
  enabled: true
  architecture: standalone
  auth:
    enabled: true

nats:
  enabled: true
  jetstream:
    enabled: true
    memStorage:
      size: 1Gi
```

### 4.3 Terraform — AWS Module

**File mới**: `infrastructure/terraform/aws/`

```
infrastructure/terraform/aws/
├── main.tf
├── variables.tf
├── outputs.tf
├── modules/
│   ├── vpc/            # VPC + subnets
│   ├── eks/            # EKS cluster
│   ├── rds/            # RDS PostgreSQL 16
│   ├── elasticache/    # ElastiCache Redis 7
│   └── s3/             # S3 buckets
└── environments/
    ├── staging.tfvars
    └── production.tfvars
```

---

## 5. Phase 4: Module Enhancements (Tuần 10–14)

### 5.1 Thứ tự Triển khai

| Tuần | Module       | Enhancement                                      | Độ phức tạp |
| ---- | ------------ | ------------------------------------------------ | ----------- |
| 10   | PM           | Thêm backend API (Prisma + API routes)           | Trung bình  |
| 10   | Accounting   | Báo cáo tài chính PDF tự động                    | Trung bình  |
| 11   | CRM          | AI Lead Scoring (Anthropic API)                  | Cao         |
| 11   | Ecommerce    | Tích hợp Shopee/Lazada API                       | Cao         |
| 12   | Cross-module | Unified Dashboard + Global Search                | Cao         |
| 12   | Cross-module | NATS Event Flows (CRM→Accounting, MRP→Ecommerce) | Trung bình  |
| 13   | HRM          | Chấm công GPS + overtime automation              | Trung bình  |
| 13   | MRP          | IoT MQTT connector prototype                     | Cao         |
| 14   | Cross-module | Notification Center (WebSocket)                  | Trung bình  |
| 14   | Cross-module | Audit Trail toàn hệ thống                        | Trung bình  |

### 5.2 Inter-Module Event Flows

**NATS event schema mới**:

```typescript
// packages/events/src/schemas/
export const EVENT_CATALOG = {
  // CRM → Accounting
  "crm.deal.won": {
    payload: {
      dealId: string,
      customerId: string,
      amount: number,
      currency: string,
    },
    target: "accounting.invoice.create",
  },
  // MRP → Ecommerce
  "mrp.production.completed": {
    payload: { productId: string, quantity: number, warehouseId: string },
    target: "ecommerce.inventory.update",
  },
  // HRM → Accounting
  "hrm.payroll.approved": {
    payload: { month: string, totalAmount: number, employees: number },
    target: "accounting.journal.create",
  },
  // Ecommerce → Accounting
  "ecommerce.order.paid": {
    payload: { orderId: string, amount: number, paymentMethod: string },
    target: "accounting.revenue.record",
  },
};
```

---

## 6. Phase 5: Documentation & Community (Tuần 15–16)

### 6.1 Docs App Nâng cấp

**Cấu trúc nội dung mới** cho `apps/docs/`:

```
apps/docs/content/
├── getting-started/
│   ├── installation.mdx
│   ├── quick-start.mdx
│   ├── project-structure.mdx
│   └── configuration.mdx
├── architecture/
│   ├── overview.mdx           # Kiến trúc tổng quan + Mermaid diagrams
│   ├── database-schema.mdx    # ER diagrams (auto-generated)
│   ├── event-system.mdx       # NATS event flows
│   └── adr/                   # Architecture Decision Records
│       ├── 001-monorepo.mdx
│       ├── 002-nextjs.mdx
│       ├── 003-prisma.mdx
│       └── 004-nats.mdx
├── modules/
│   ├── hrm.mdx
│   ├── crm.mdx
│   ├── accounting.mdx
│   ├── ecommerce.mdx
│   ├── mrp.mdx
│   └── ...
├── api-reference/             # Auto-generated từ OpenAPI
├── deployment/
│   ├── docker.mdx
│   ├── kubernetes.mdx
│   ├── aws.mdx
│   ├── gcp.mdx
│   └── azure.mdx
└── contributing/
    ├── development-guide.mdx
    ├── testing-guide.mdx
    └── code-style.mdx
```

### 6.2 Demo Instance

| Thành phần | Chi tiết                                             |
| ---------- | ---------------------------------------------------- |
| URL        | `demo.vierp.dev`                                     |
| Hosting    | Docker Compose trên VPS (Hetzner/DigitalOcean)       |
| Data       | Sample data 5 công ty mẫu với đầy đủ dữ liệu VN      |
| Reset      | Tự động reset mỗi 24h                                |
| Accounts   | demo@vierp.dev / demo123 (read-only + limited write) |

---

## 7. Risk Management

### Rủi ro & Giảm thiểu

| #   | Rủi ro                                 | Xác suất   | Tác động   | Giảm thiểu                                               |
| --- | -------------------------------------- | ---------- | ---------- | -------------------------------------------------------- |
| R1  | Breaking changes khi nâng cấp Next.js  | Trung bình | Cao        | Nâng cấp từng app, giữ version lock, E2E regression      |
| R2  | Performance degradation với metrics    | Thấp       | Trung bình | Sampling rate 10%, async metrics collection              |
| R3  | Terraform state conflicts              | Trung bình | Cao        | Remote state (S3 backend), state locking (DynamoDB)      |
| R4  | NATS message loss khi thêm event flows | Thấp       | Cao        | JetStream persistence, DLQ retry, idempotent consumers   |
| R5  | Database migration failures            | Trung bình | Cao        | Dry-run trong CI, backup trước migrate, rollback scripts |
| R6  | Contributor conflicts                  | Thấp       | Thấp       | Branch protection, PR reviews, coding standards doc      |

### Rollback Strategy

Mỗi phase có chiến lược rollback riêng:

- **Phase 1**: Revert CI config, tests không ảnh hưởng production
- **Phase 2**: Feature flags cho metrics/observability, tắt được ngay
- **Phase 3**: Blue-green deployment, rollback Helm release
- **Phase 4**: Feature flags cho từng enhancement, gradual rollout
- **Phase 5**: Documentation changes không ảnh hưởng runtime

---

## Checklist Tổng quan / Master Checklist

### Phase 1 (Tuần 1–3)

- [ ] E2E tests: Accounting (8 specs)
- [ ] E2E tests: Ecommerce (6 specs)
- [ ] E2E tests: PM (4 specs)
- [ ] Unit tests: packages/auth, events, cache, database, security
- [ ] CI: Coverage reporting (Codecov)
- [ ] CI: Security audit (npm audit + Trivy)
- [ ] CI: Docker build verification
- [ ] CI: Release automation
- [ ] DX: scripts/setup.sh
- [ ] DX: Makefile
- [ ] DX: Husky + lint-staged + commitlint
- [ ] DX: .devcontainer/

### Phase 2 (Tuần 4–6)

- [ ] Package: @vierp/openapi
- [ ] Swagger UI trên 14 apps
- [ ] API docs portal tập trung
- [ ] Postman collection
- [ ] Package: @vierp/metrics
- [ ] Prometheus + Grafana setup
- [ ] 5 Grafana dashboards
- [ ] Sentry/GlitchTip error tracking
- [ ] Loki centralized logging
- [ ] Package: @vierp/rate-limit
- [ ] Security headers audit
- [ ] Zod validation 100%

### Phase 3 (Tuần 7–9)

- [ ] Dockerfile cho tất cả 14 apps
- [ ] docker-compose.prod.yml
- [ ] GitHub Container Registry pipeline
- [ ] Trivy image scanning
- [ ] Helm chart: charts/vierp/
- [ ] HPA configuration
- [ ] Ingress + cert-manager
- [ ] Terraform: AWS module
- [ ] Terraform: GCP module (tuỳ chọn)

### Phase 4 (Tuần 10–14)

- [ ] PM: Backend API
- [ ] Accounting: Báo cáo tài chính PDF
- [ ] CRM: AI Lead Scoring
- [ ] Ecommerce: Shopee/Lazada integration
- [ ] Unified Dashboard
- [ ] Global Search (Meilisearch)
- [ ] NATS Event Flows
- [ ] Notification Center
- [ ] Audit Trail

### Phase 5 (Tuần 15–16)

- [ ] Docs app nâng cấp (MDX content)
- [ ] Architecture Decision Records
- [ ] ER diagrams tự động
- [ ] Deployment guides (Docker, K8s, Cloud)
- [ ] Demo instance
- [ ] GitHub Discussions
- [ ] Contributor guidelines mở rộng

---

_Kế hoạch triển khai này là phần bổ sung cho [ROADMAP.md](./ROADMAP.md). Cập nhật tiến độ hàng tuần._
_This upgrade plan supplements [ROADMAP.md](./ROADMAP.md). Progress tracked weekly._
