# Getting Started Guide

**Hướng dẫn bắt đầu / Getting Started Guide**

## Prerequisites / Yêu cầu

Before you begin, ensure you have the following installed on your system:

**Tiền điều kiện / Các yêu cầu:**

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm 10+** or **pnpm 8+** (npm is recommended)
- **Docker 24+** & **Docker Compose 2.20+** - [Download](https://www.docker.com/products/docker-desktop)
- **PostgreSQL 16** (optional - Docker includes this)
- **Git 2.40+**

```bash
# Verify versions / Kiểm tra phiên bản
node --version    # Should be >= 20.0.0
npm --version     # Should be >= 10.0.0
docker --version  # Should be >= 24.0.0
```

## Installation & Setup / Cài đặt & Thiết lập

### 1. Clone the Repository / Sao chép kho lưu trữ

```bash
git clone https://github.com/nclamvn/Viet-ERP.git
cd Viet-ERP
```

### 2. Install Dependencies / Cài đặt phụ thuộc

```bash
# Install all dependencies across workspace / Cài đặt tất cả phụ thuộc
npm install

# Or using make command / Hoặc sử dụng lệnh make
make setup
```

This will:

- Install root dependencies
- Install app dependencies (apps/\*)
- Install shared packages (packages/\*)
- Generate Prisma clients

### 3. Configure Environment Variables / Cấu hình biến môi trường

Copy and customize the example environment file:

```bash
cp .env.example .env.local
```

**Key variables / Các biến chính:**

```env
# Database / Cơ sở dữ liệu
DATABASE_URL="postgresql://erp:erp_dev_2026@localhost:5432/erp_dev"

# Redis
REDIS_URL="redis://localhost:6379"

# NATS Event Streaming
NATS_URL="nats://localhost:4222"

# Keycloak SSO
KEYCLOAK_URL="http://localhost:8080"
KEYCLOAK_ADMIN="admin"
KEYCLOAK_ADMIN_PASSWORD="admin"

# API Gateway (Kong)
KONG_ADMIN_URL="http://localhost:8001"

# Shared packages
NODE_ENV="development"
```

### 4. Start Infrastructure with Docker / Khởi động cơ sở hạ tầng

```bash
# Start all services (PostgreSQL, Redis, NATS, Keycloak, Kong)
docker compose up -d

# Or using make / Hoặc sử dụng make
make docker-up

# Verify services are running / Xác minh các dịch vụ đang chạy
docker compose ps
```

Expected output:

```
NAME                COMMAND              SERVICE      STATUS      PORTS
vierp-postgres      postgres             postgres     Up 2m       5432/tcp
vierp-redis        redis-server         redis        Up 2m       6379/tcp
vierp-nats         nats -js -sd /data  nats         Up 2m       4222/tcp
vierp-keycloak     /opt/keycloak/...    keycloak     Up 1m       8080/tcp
vierp-kong         /docker-entrypoint   kong         Up 1m       8000/tcp, 8001/tcp
```

### 5. Initialize Database / Khởi tạo cơ sở dữ liệu

```bash
# Generate Prisma clients
npm run db:generate

# Create database schema
npm run db:push

# Seed initial data (optional)
npm run db:seed
```

## Starting Development Server / Khởi động máy chủ phát triển

### Development Mode / Chế độ phát triển

```bash
# Start all apps in development mode (watches for changes)
npm run dev

# Or using make / Hoặc sử dụng make
make dev

# Or start individual app / Hoặc khởi động ứng dụng riêng lẻ
cd apps/HRM-unified
npm run dev
```

Turbo will run all apps concurrently. Output shows each app's port:

```
 █  apps/HRM-unified          | ready - started server on 0.0.0.0:3003
 █  apps/CRM                  | ready - started server on 0.0.0.0:3002
 █  apps/MRP                  | ready - started server on 0.0.0.0:3004
 █  apps/PM                   | ready - started server on 0.0.0.0:3005
 █  apps/Accounting           | ready - started server on 0.0.0.0:3007
 █  apps/Ecommerce            | ready - started server on 0.0.0.0:3008
 █  apps/ExcelAI              | ready - started server on 0.0.0.0:3010
 █  apps/OTB                  | ready - started server on 0.0.0.0:3011
 █  apps/TPM-web              | ready - started server on 0.0.0.0:3012
 █  apps/Admin                | ready - started server on 0.0.0.0:3013
 █  apps/docs                 | ready - started server on 0.0.0.0:3014
```

### Port Reference / Tham chiếu cổng

| Module      | Port | URL                   | Description                               |
| ----------- | ---- | --------------------- | ----------------------------------------- |
| HRM-unified | 3003 | http://localhost:3003 | Human Resource Management (AI-integrated) |
| CRM         | 3002 | http://localhost:3002 | Customer Relationship Management          |
| MRP         | 3004 | http://localhost:3004 | Manufacturing Resource Planning           |
| PM          | 3005 | http://localhost:3005 | Project Management                        |
| Accounting  | 3007 | http://localhost:3007 | Accounting (VAS compliance)               |
| Ecommerce   | 3008 | http://localhost:3008 | E-Commerce Platform                       |
| ExcelAI     | 3010 | http://localhost:3010 | AI Excel Analysis                         |
| OTB         | 3011 | http://localhost:3011 | Open-To-Buy Planning                      |
| TPM         | 3012 | http://localhost:3012 | Trade Promotion Management                |
| Admin       | 3013 | http://localhost:3013 | System Administration                     |
| Docs        | 3014 | http://localhost:3014 | Documentation Portal                      |

### Infrastructure Services / Dịch vụ cơ sở hạ tầng

| Service    | Port | URL                         | Description          |
| ---------- | ---- | --------------------------- | -------------------- |
| PostgreSQL | 5432 | postgresql://localhost:5432 | Primary database     |
| Redis      | 6379 | redis://localhost:6379      | Cache & sessions     |
| NATS       | 4222 | nats://localhost:4222       | Event streaming      |
| NATS HTTP  | 8222 | http://localhost:8222       | NATS monitoring      |
| Keycloak   | 8080 | http://localhost:8080/auth  | SSO & authentication |
| Kong       | 8000 | http://localhost:8000       | API Gateway (proxy)  |
| Kong Admin | 8001 | http://localhost:8001       | Kong administration  |

## First Steps / Các bước đầu tiên

### 1. Access the Admin Dashboard / Truy cập bảng điều khiển quản trị

```
http://localhost:3013
```

Default credentials / Thông tin đăng nhập mặc định:

- Email: `admin@vierp.local`
- Password: `admin123` (change this in production / đổi điều này trong sản xuất)

### 2. Create Your First User Account / Tạo tài khoản người dùng đầu tiên

1. Go to **Admin** → **User Management** / **Quản lý người dùng**
2. Click **Add User** / **Thêm người dùng**
3. Enter email, name, and select role / Nhập email, tên và chọn vai trò
4. Set password / Đặt mật khẩu
5. Click **Create** / **Tạo**

### 3. Assign Permissions / Gán quyền

1. Go to **Admin** → **Roles** / **Vai trò**
2. Select role and click **Edit** / **Chọn vai trò và nhấp vào Chỉnh sửa**
3. Grant permissions for modules / Cấp quyền cho các module
4. Save changes / **Lưu thay đổi**

### 4. Explore a Module / Khám phá một module

Start with **HRM**:

```
http://localhost:3001
```

**Key sections:**

- **Employees** / **Nhân viên** - Add and manage employees
- **Attendance** / **Chấm công** - Track attendance
- **Payroll** / **Bảng lương** - Manage salaries
- **Leave** / **Nghỉ phép** - Request and approve leave

### 5. Check API Documentation / Kiểm tra tài liệu API

Access OpenAPI documentation for each module:

```
http://localhost:3001/api/docs      # HRM API docs
http://localhost:3002/api/docs      # CRM API docs
http://localhost:3007/api/docs      # Accounting API docs
```

## Running Tests / Chạy kiểm thử

### Unit Tests / Kiểm thử đơn vị

```bash
# Run all unit tests / Chạy tất cả các kiểm thử đơn vị
npm run test

# Watch mode / Chế độ theo dõi
npm run test -- --watch

# Specific package / Gói cụ thể
npm run test -- packages/auth
```

### End-to-End Tests / Kiểm thử E2E

```bash
# Run all E2E tests / Chạy tất cả các kiểm thử E2E
npm run test:e2e

# Headed mode (see browser) / Chế độ headed (xem trình duyệt)
npm run test:e2e -- --headed

# Specific app / Ứng dụng cụ thể
npm run test:e2e -- apps/HRM-unified
```

## Building for Production / Xây dựng cho sản xuất

```bash
# Build all apps and packages
npm run build

# Or using make
make build

# Check build output
du -sh apps/*/dist
```

## Troubleshooting / Khắc phục sự cố

### Port Already in Use / Cổng đã được sử dụng

```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Database Connection Failed / Kết nối cơ sở dữ liệu thất bại

```bash
# Check PostgreSQL container logs
docker logs vierp-postgres

# Verify DATABASE_URL in .env.local
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### Redis Connection Failed / Kết nối Redis thất bại

```bash
# Check Redis container logs
docker logs vierp-redis

# Test connection
redis-cli ping
```

### Module Not Starting / Module không khởi động

```bash
# Check logs for specific app
npm run dev -- --filter=apps/HRM-unified

# Check node_modules installation
npm ls @vierp/auth

# Rebuild specific app
cd apps/HRM-unified && npm run build
```

## Next Steps / Bước tiếp theo

1. Read **[Module Development Guide](./module-development.md)** to create custom modules
2. Learn about **[Testing](./testing.md)** best practices
3. Explore **[API Reference](../api/README.md)** for integration
4. Setup **[Deployment](./deployment.md)** for production

## Getting Help / Nhận trợ giúp

- **Documentation**: http://localhost:3014 (local docs)
- **GitHub Issues**: https://github.com/nclamvn/Viet-ERP/issues
- **Community**: [Discord/Forum link - TBD]
- **Enterprise Support**: support@vierp.vn
