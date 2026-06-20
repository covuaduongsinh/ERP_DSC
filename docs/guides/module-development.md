# Module Development Guide

**Hướng dẫn phát triển module / Module Development Guide**

This guide explains how to create new modules within the VietERP ecosystem using the npm workspace structure, Turborepo, and shared packages.

## Architecture Overview / Tổng quan kiến trúc

VietERP uses:

- **Monorepo** with npm workspaces (Node 20+)
- **Turborepo** for build orchestration
- **Next.js 14** for frontend & API routes
- **TypeScript** for type safety
- **Prisma ORM** with PostgreSQL
- **NATS JetStream** for event-driven architecture
- **Shared packages** for auth, events, cache, etc.

## Creating a New Module / Tạo module mới

### 1. Generate Module Scaffold / Tạo khung module

```bash
# From project root / Từ thư mục gốc
mkdir -p apps/YourModule
cd apps/YourModule

# Initialize package.json
npm init -y

# Or copy from existing module template
cp -r apps/HRM-unified/* apps/YourModule/
```

### 2. Module Structure / Cấu trúc module

```
apps/YourModule/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── [resource]/
│   │   │   │   ├── route.ts          # GET /api/v1/resource
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts      # GET /api/v1/resource/:id
│   │   │   └── ...
│   │   ├── health/
│   │   │   └── route.ts              # Health check endpoint
│   │   ├── metrics/
│   │   │   └── route.ts              # Prometheus metrics
│   │   └── docs/
│   │       └── route.ts              # OpenAPI specification
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Home page
│   └── [...rest]/page.tsx            # Catch-all for dynamic routes
├── src/
│   ├── lib/
│   │   ├── prisma.ts                 # Prisma client singleton
│   │   ├── auth.ts                   # Auth utilities
│   │   ├── events.ts                 # Event publisher
│   │   └── cache.ts                  # Cache utilities
│   ├── middleware/
│   │   ├── auth.ts                   # Auth middleware
│   │   ├── validation.ts             # Input validation
│   │   ├── error-handler.ts          # Error handling
│   │   └── logger.ts                 # Request logging
│   ├── routes/
│   │   └── v1.ts                     # Route definitions
│   ├── schemas/
│   │   └── your-resource.ts          # Zod schemas
│   ├── services/
│   │   └── your-resource.service.ts  # Business logic
│   ├── handlers/
│   │   └── your-resource.handler.ts  # Route handlers
│   └── types/
│       └── index.ts                  # Shared types
├── prisma/
│   ├── schema.prisma                 # Database schema
│   └── migrations/                   # Database migrations
├── tests/
│   ├── unit/
│   │   └── services.test.ts
│   ├── e2e/
│   │   └── api.spec.ts
│   └── fixtures/
│       └── test-data.ts
├── public/
│   └── [static files]
├── package.json
├── tsconfig.json
├── next.config.js
├── vitest.config.ts
├── Dockerfile
└── README.md
```

### 3. Configure package.json / Cấu hình package.json

```json
{
  "name": "@vierp/your-module",
  "version": "1.0.0",
  "description": "Your Module Description",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "dev": "next dev --port 3015",
    "build": "next build",
    "start": "next start --port 3015",
    "test": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "node prisma/seed.ts"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "prisma": "^5.0.0",
    "@prisma/client": "^5.0.0",
    "@vierp/auth": "workspace:*",
    "@vierp/events": "workspace:*",
    "@vierp/cache": "workspace:*",
    "@vierp/database": "workspace:*",
    "@vierp/logger": "workspace:*",
    "@vierp/errors": "workspace:*",
    "@vierp/api-middleware": "workspace:*",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@playwright/test": "^1.40.0",
    "eslint": "^8.50.0"
  }
}
```

### 4. TypeScript Configuration / Cấu hình TypeScript

Create `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "lib": ["es2020", "dom", "dom.iterable"],
    "jsx": "preserve",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "app"],
  "exclude": ["node_modules", "dist", ".next"]
}
```

### 5. Prisma Schema / Lược đồ Prisma

Create `prisma/schema.prisma`:

```prisma
// This is your Prisma schema file
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// Share common models via @vierp/database
// Or define module-specific models below

model YourResource {
  id        String   @id @default(cuid())
  tenantId  String   @db.Uuid
  name      String
  email     String?
  status    String   @default("active")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  updatedBy String?

  // Relations
  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, email])
  @@index([tenantId])
  @@index([status])

  // Audit trail
  @@map("your_resources")
}

// Reference shared models
model Tenant {
  id String @id @db.Uuid
  @@map("tenants")
}
```

### 6. Authentication & Authorization / Xác thực & Phân quyền

Use shared `@vierp/auth` package:

```typescript
// app/api/v1/your-resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@vierp/auth";
import { requirePermission } from "@vierp/auth";

export const GET = withAuth(async (req: NextRequest, context: any) => {
  // User already authenticated by middleware
  const { user, tenantId } = context;

  // Check specific permission
  await requirePermission(user, "read:your-resource");

  return NextResponse.json({ data: [] });
});

export const POST = withAuth(
  async (req: NextRequest, context: any) => {
    const { user, tenantId } = context;

    await requirePermission(user, "create:your-resource");

    const body = await req.json();
    // Create logic

    return NextResponse.json({ success: true }, { status: 201 });
  },
  { method: "POST" },
);
```

### 7. Event-Driven Architecture / Kiến trúc hướng sự kiện

Use `@vierp/events` for publishing domain events:

```typescript
// src/lib/events.ts
import { publishEvent } from "@vierp/events";

export async function createYourResource(data: CreatePayload) {
  // Create in database
  const resource = await prisma.yourResource.create({ data });

  // Publish event for other modules to consume
  await publishEvent({
    type: "your-module.resource.created",
    aggregateId: resource.id,
    tenantId: resource.tenantId,
    userId: userId,
    data: {
      id: resource.id,
      name: resource.name,
    },
    metadata: {
      timestamp: new Date(),
      source: "your-module",
    },
  });

  return resource;
}
```

Subscribe to events:

```typescript
// src/lib/event-listeners.ts
import { subscribeToEvents } from "@vierp/events";

export function setupEventListeners() {
  // Listen to accounting module events
  subscribeToEvents("accounting.*", async (event) => {
    console.log("Accounting event received:", event);

    if (event.type === "accounting.invoice.created") {
      // Handle invoice created event
      await handleInvoiceCreated(event.data);
    }
  });
}
```

### 8. Caching / Bộ nhớ đệm

Use `@vierp/cache` for Redis integration:

```typescript
// src/lib/cache.ts
import { cache } from "@vierp/cache";

export async function getYourResourceWithCache(id: string) {
  const cacheKey = `your-resource:${id}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  // Fetch from database
  const resource = await prisma.yourResource.findUnique({
    where: { id },
  });

  if (resource) {
    // Cache for 1 hour
    await cache.set(cacheKey, resource, 3600);
  }

  return resource;
}
```

### 9. API Route Patterns / Mẫu tuyến API

RESTful API with Zod validation:

```typescript
// src/schemas/your-resource.ts
import { z } from "zod";

export const createYourResourceSchema = z.object({
  name: z.string().min(1, "Name required"),
  email: z.string().email("Invalid email"),
  status: z.enum(["active", "inactive"]).optional(),
});

export type CreateYourResourceInput = z.infer<typeof createYourResourceSchema>;
```

```typescript
// app/api/v1/your-resource/route.ts
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@vierp/auth";
import {
  handleValidationError,
  handleServerError,
} from "@vierp/api-middleware";
import { createYourResourceSchema } from "@/schemas/your-resource";
import * as service from "@/services/your-resource.service";

export const GET = withAuth(async (req: NextRequest, { tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const result = await service.list(tenantId, { page, limit });

    return NextResponse.json(result);
  } catch (error) {
    return handleServerError(error);
  }
});

export const POST = withAuth(async (req: NextRequest, { tenantId, userId }) => {
  try {
    const body = await req.json();

    // Validate input
    const validated = createYourResourceSchema.parse(body);

    const resource = await service.create(tenantId, userId, validated);

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return handleValidationError(error);
    }
    return handleServerError(error);
  }
});
```

### 10. Service Layer / Lớp dịch vụ

```typescript
// src/services/your-resource.service.ts
import { prisma } from "@/lib/prisma";
import { publishEvent } from "@vierp/events";
import type { CreateYourResourceInput } from "@/schemas/your-resource";

export async function list(
  tenantId: string,
  options: { page: number; limit: number },
) {
  const skip = (options.page - 1) * options.limit;

  const [items, total] = await Promise.all([
    prisma.yourResource.findMany({
      where: { tenantId },
      skip,
      take: options.limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.yourResource.count({ where: { tenantId } }),
  ]);

  return {
    data: items,
    pagination: {
      page: options.page,
      limit: options.limit,
      total,
      pages: Math.ceil(total / options.limit),
    },
  };
}

export async function create(
  tenantId: string,
  userId: string,
  input: CreateYourResourceInput,
) {
  const resource = await prisma.yourResource.create({
    data: {
      ...input,
      tenantId,
      createdBy: userId,
    },
  });

  // Publish domain event
  await publishEvent({
    type: "your-module.resource.created",
    aggregateId: resource.id,
    tenantId,
    userId,
    data: resource,
    metadata: { timestamp: new Date(), source: "your-module" },
  });

  return resource;
}
```

## Testing Requirements / Yêu cầu kiểm thử

### Unit Tests / Kiểm thử đơn vị

```typescript
// tests/unit/services.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { create, list } from "@/services/your-resource.service";

describe("YourResource Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new resource", async () => {
    const result = await create("tenant-1", "user-1", {
      name: "Test Resource",
      email: "test@example.com",
    });

    expect(result).toHaveProperty("id");
    expect(result.name).toBe("Test Resource");
  });

  it("should list resources with pagination", async () => {
    const result = await list("tenant-1", { page: 1, limit: 20 });

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(Array.isArray(result.data)).toBe(true);
  });
});
```

### E2E Tests / Kiểm thử E2E

```typescript
// tests/e2e/api.spec.ts
import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:3015";
const API_TOKEN = "test-bearer-token";

test.describe("YourResource API", () => {
  test("should create and retrieve resource", async ({ request }) => {
    // Create
    const createRes = await request.post(`${BASE_URL}/api/v1/your-resource`, {
      headers: { Authorization: `Bearer ${API_TOKEN}` },
      data: {
        name: "Test Resource",
        email: "test@example.com",
      },
    });

    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    expect(created).toHaveProperty("id");

    // Retrieve
    const getRes = await request.get(
      `${BASE_URL}/api/v1/your-resource/${created.id}`,
      {
        headers: { Authorization: `Bearer ${API_TOKEN}` },
      },
    );

    expect(getRes.status()).toBe(200);
  });
});
```

## Database Migration / Di chuyển cơ sở dữ liệu

```bash
# Generate migration
npx prisma migrate dev --name add_your_model

# This creates:
# - prisma/migrations/[timestamp]_add_your_model/migration.sql
# - Applies to development database
```

## Docker Setup / Cấu hình Docker

Create `Dockerfile` in module root:

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --production=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3015
CMD ["node", "server.js"]
```

Add to docker-compose.yml:

```yaml
your-module:
  build:
    context: .
    dockerfile: apps/YourModule/Dockerfile
  environment:
    DATABASE_URL: postgresql://erp:erp_dev_2026@postgres:5432/erp_dev
    REDIS_URL: redis://redis:6379
    NATS_URL: nats://nats:4222
  ports:
    - "3015:3015"
  depends_on:
    - postgres
    - redis
    - nats
  networks:
    - erp-network
```

## Best Practices / Thực tiễn tốt nhất

1. **Always use tenantId** - Multi-tenancy is built-in
2. **Publish domain events** - Enable loose coupling between modules
3. **Validate input** - Use Zod schemas consistently
4. **Cache strategically** - Use Redis for expensive operations
5. **Write tests** - Aim for ≥70% coverage
6. **Document APIs** - Keep OpenAPI spec updated
7. **Use shared packages** - Don't reinvent auth, logging, etc.
8. **Follow naming conventions** - `create*`, `update*`, `delete*`, `list*`
9. **Handle errors gracefully** - Return proper HTTP status codes
10. **Monitor & log** - Use `@vierp/logger` for structured logging

## Next Steps / Bước tiếp theo

1. Read **[Testing Guide](./testing.md)** for comprehensive test coverage
2. Learn about **[Deployment](./deployment.md)** strategies
3. Review **[API Reference](../api/README.md)** for integration patterns
4. Join module discussions in **GitHub Issues** or **Discord**
