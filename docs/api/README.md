# API Reference Overview

**Tham chiếu API / API Reference Overview**

Complete API reference for the VietERP Platform. All modules provide RESTful JSON APIs with comprehensive authentication and error handling.

## Base URLs / URL cơ sở

### Development / Phát triển

```
http://localhost:8000/api/v1
```

Using Kong API Gateway which routes to:

```
HRM          → http://localhost:3001
CRM          → http://localhost:3002
MRP          → http://localhost:3003
PM           → http://localhost:3005
Accounting   → http://localhost:3007
Ecommerce    → http://localhost:3008
ExcelAI      → http://localhost:3010
OTB          → http://localhost:3011
TPM          → http://localhost:3012
```

### Production / Sản xuất

```
https://api.vierp.vn/api/v1
```

## Authentication / Xác thực

VietERP supports two authentication methods:

### 1. JWT Bearer Token / Token JWT Bearer

For user sessions and web applications:

```bash
# Login endpoint
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@company.vn",
    "password": "your-password"
  }'

# Response
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "user": {
    "id": "user-123",
    "email": "user@company.vn",
    "name": "John Doe",
    "roles": ["employee", "project_manager"]
  }
}
```

Use token in subsequent requests:

```typescript
const headers = {
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
};

const response = await fetch("http://localhost:8000/api/v1/hrm/employees", {
  method: "GET",
  headers,
});
```

Refresh token when expired:

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
  }'
```

### 2. API Key Authentication / Xác thực API Key

For SDK and server-to-server integrations:

```typescript
import { ERPClient } from "@vierp/sdk";

const client = new ERPClient({
  baseUrl: "https://api.vierp.vn",
  apiKey: "vierp_live_abc123xyz789...",
  tenantId: "tenant-id-here",
});

// All requests automatically include API key
const employees = await client.hrm.employees.list();
```

API Key format:

- Prefix: `vierp_live_` (production) or `vierp_test_` (testing)
- Signed with HMAC-SHA256
- Include in header: `X-API-Key: vierp_live_...`

## Common Headers / Tiêu đề chung

All requests should include:

```
Authorization: Bearer <token>
Content-Type: application/json
X-Tenant-ID: <tenant-id>          # Multi-tenancy identifier
X-Request-ID: <uuid>              # Tracing
X-Idempotency-Key: <uuid>         # For POST/PUT (deduplication)
User-Agent: MyApp/1.0
```

Example:

```bash
curl -X GET http://localhost:8000/api/v1/crm/customers \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant-123" \
  -H "X-Request-ID: 123e4567-e89b-12d3-a456-426614174000"
```

## Response Format / Định dạng phản hồi

### Success Response / Phản hồi thành công

```json
{
  "data": {
    "id": "resource-id",
    "name": "Resource Name",
    "createdAt": "2026-03-29T10:00:00Z"
  },
  "meta": {
    "requestId": "123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2026-03-29T10:00:01Z"
  }
}
```

### List Response with Pagination / Phản hồi danh sách

```json
{
  "data": [
    { "id": "1", "name": "Item 1" },
    { "id": "2", "name": "Item 2" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  },
  "meta": {
    "requestId": "123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2026-03-29T10:00:01Z"
  }
}
```

### Error Response / Phản hồi lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "statusCode": 400,
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "meta": {
    "requestId": "123e4567-e89b-12d3-a456-426614174000",
    "timestamp": "2026-03-29T10:00:01Z"
  }
}
```

## HTTP Status Codes / Mã trạng thái HTTP

| Code    | Meaning               | Example                                    |
| ------- | --------------------- | ------------------------------------------ |
| **200** | OK                    | Successful GET, no content changes         |
| **201** | Created               | Successful POST creating new resource      |
| **204** | No Content            | Successful DELETE or empty response        |
| **400** | Bad Request           | Validation error, malformed request        |
| **401** | Unauthorized          | Missing or invalid authentication token    |
| **403** | Forbidden             | Insufficient permissions for resource      |
| **404** | Not Found             | Resource does not exist                    |
| **409** | Conflict              | Duplicate key (e.g., email already exists) |
| **422** | Unprocessable Entity  | Request semantically correct but invalid   |
| **429** | Too Many Requests     | Rate limit exceeded                        |
| **500** | Internal Server Error | Server error (not client's fault)          |
| **503** | Service Unavailable   | Service temporarily unavailable            |

## Pagination / Phân trang

All list endpoints support pagination:

```bash
curl "http://localhost:8000/api/v1/crm/customers?page=2&limit=50"
```

Parameters:

- `page` (default: 1) - Page number, starting from 1
- `limit` (default: 20, max: 100) - Items per page

Response includes pagination metadata:

```json
{
  "pagination": {
    "page": 2,
    "limit": 50,
    "total": 250,
    "pages": 5
  }
}
```

## Filtering & Searching / Lọc & Tìm kiếm

### Query Parameters / Thông số truy vấn

```bash
# Filter by field
?status=active

# Multiple values (OR)
?status=active,inactive

# Comparison operators
?salary__gte=10000000  # Greater than or equal
?salary__lt=50000000   # Less than
?createdAt__gte=2026-01-01

# Text search
?search=john%20doe
?name__icontains=john

# Sort
?sort=name,-createdAt  # Ascending name, descending createdAt
```

### Example / Ví dụ

```bash
# Get active customers created in 2026, sorted by name
curl "http://localhost:8000/api/v1/crm/customers?status=active&createdAt__gte=2026-01-01&sort=name"
```

## Rate Limiting / Giới hạn tốc độ

API enforces rate limits per tenant:

**Limits:**

- Public endpoints: 100 requests/minute
- API endpoints: 1000 requests/minute
- Authentication: 10 requests/15 minutes
- Webhooks: 30 requests/minute

**Headers:**

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1648564345
```

When limit exceeded (HTTP 429):

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "statusCode": 429,
    "retryAfter": 60
  }
}
```

## Idempotency / Tính chất idempotent

For POST and PUT requests, use `X-Idempotency-Key` to ensure idempotency:

```bash
curl -X POST http://localhost:8000/api/v1/crm/customers \
  -H "X-Idempotency-Key: 123e4567-e89b-12d3-a456-426614174000" \
  -H "Content-Type: application/json" \
  -d '{"name": "New Customer"}'
```

Same key sent within 24 hours returns same response without duplicate creation.

## Error Handling / Xử lý lỗi

### Common Error Codes / Mã lỗi chung

| Code                       | HTTP | Description                            |
| -------------------------- | ---- | -------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Input validation failed                |
| `AUTHENTICATION_REQUIRED`  | 401  | Missing or invalid token               |
| `INSUFFICIENT_PERMISSIONS` | 403  | User lacks required permissions        |
| `RESOURCE_NOT_FOUND`       | 404  | Resource does not exist                |
| `RESOURCE_ALREADY_EXISTS`  | 409  | Duplicate resource (unique constraint) |
| `INVALID_OPERATION`        | 422  | Business logic violation               |
| `RATE_LIMIT_EXCEEDED`      | 429  | Too many requests                      |
| `INTERNAL_SERVER_ERROR`    | 500  | Server error                           |
| `SERVICE_UNAVAILABLE`      | 503  | Service temporarily down               |

### Handling Errors in Code / Xử lý lỗi trong code

```typescript
import { ERPError } from "@vierp/sdk";

try {
  const customer = await client.crm.customers.create({
    name: "Company ABC",
    email: "contact@abc.vn",
  });
} catch (error) {
  if (error instanceof ERPError) {
    console.log(`Error ${error.code}: ${error.message}`);
    console.log(`Status: ${error.statusCode}`);
    console.log(`Details:`, error.details);

    // Handle specific errors
    if (error.code === "VALIDATION_ERROR") {
      // Show validation errors to user
      error.details?.forEach((detail) => {
        console.log(`Field ${detail.field}: ${detail.message}`);
      });
    } else if (error.statusCode === 429) {
      // Implement exponential backoff
      await sleep(error.retryAfter * 1000);
      // Retry request
    }
  }
}
```

## Webhooks / Webhook

VietERP can send real-time notifications to your application:

```bash
# Register webhook
curl -X POST http://localhost:8000/api/v1/webhooks \
  -H "Authorization: Bearer ..." \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/vierp",
    "events": ["customer.created", "invoice.paid", "order.*"],
    "secret": "your-webhook-secret"
  }'
```

**Webhook payload:**

```json
{
  "id": "webhook-event-123",
  "event": "customer.created",
  "timestamp": "2026-03-29T10:00:00Z",
  "tenantId": "tenant-123",
  "data": {
    "id": "customer-456",
    "name": "New Customer",
    "email": "contact@example.com"
  },
  "signature": "sha256=abc123..."
}
```

**Verify signature:**

```typescript
import crypto from "crypto";

function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
) {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${hash}`),
    Buffer.from(signature),
  );
}
```

## Module APIs / API module

Complete documentation for each module:

- **[Accounting API](./accounting.md)** - Financial management
- **[CRM API](./crm.md)** - Customer relationships
- **[E-commerce API](./ecommerce.md)** - Online sales
- **[HRM API](./hrm.md)** - Human resources
- **[MRP API](./mrp.md)** - Manufacturing & inventory

## SDK / SDK

Type-safe TypeScript SDK simplifies API usage:

```typescript
import { ERPClient } from "@vierp/sdk";

const client = new ERPClient({
  baseUrl: "https://api.vierp.vn",
  apiKey: process.env.ERP_API_KEY,
  tenantId: "your-tenant-id",
});

// Fully typed
const customers = await client.crm.customers.list({ status: "active" });
const invoice = await client.accounting.invoices.get("inv-123");
const employee = await client.hrm.employees.create({
  firstName: "John",
  lastName: "Doe",
  email: "john@company.vn",
});
```

## API Documentation Portal / Cổng tài liệu API

Access interactive API documentation:

- **Development**: http://localhost:3014 (after `npm run dev`)
- **Staging**: https://docs-staging.vierp.vn
- **Production**: https://docs.vierp.vn

Features:

- Interactive endpoint testing
- Real-time request/response examples
- Schema documentation
- Rate limit information
- Error code reference

## Best Practices / Thực tiễn tốt nhất

### Request / Yêu cầu

1. **Use request IDs** - Include `X-Request-ID` for debugging
2. **Implement timeouts** - 30s typical, 60s for long operations
3. **Add retry logic** - Exponential backoff for 429/5xx
4. **Validate input** - Check required fields before sending
5. **Use compression** - Enable gzip for large payloads

### Response / Phản hồi

1. **Check status code** - 200-299 is success
2. **Handle errors gracefully** - Parse error details
3. **Respect rate limits** - Check X-RateLimit headers
4. **Cache when possible** - Reduce API calls
5. **Log requests** - For debugging and monitoring

### Security / Bảo mật

1. **Store keys securely** - Use environment variables
2. **Use HTTPS** - Always in production
3. **Rotate API keys** - Periodically update
4. **Validate webhooks** - Verify signatures
5. **Minimal permissions** - Grant only needed scopes

## Versioning / Quản lý phiên bản

Current API version: **v1**

VietERP follows semantic versioning:

- Breaking changes → Major version (v2, v3)
- New features → Minor version (v1.1, v1.2)
- Bug fixes → Patch version (v1.0.1, v1.0.2)

Old versions supported for 12 months after deprecation announcement.

## Next Steps / Bước tiếp theo

1. Read module-specific API docs:
   - [Accounting API](./accounting.md)
   - [CRM API](./crm.md)
   - [E-commerce API](./ecommerce.md)
   - [HRM API](./hrm.md)
   - [MRP API](./mrp.md)

2. Try SDK:

   ```bash
   npm install @vierp/sdk
   ```

3. Explore interactive docs at http://localhost:3014

4. Check [Contributing Guide](../guides/contributing.md) for integrations
