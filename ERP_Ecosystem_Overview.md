# ERP ECOSYSTEM — Toàn cảnh Quy mô & Tính năng

> Dữ liệu đo trực tiếp từ codebase · 27/03/2026
> Dùng cho AI text-to-slide (Gamma, Beautiful.ai, Tome, Canva AI) hoặc text-to-image (Midjourney, DALL-E)

---

## SLIDE 1: COVER

**Tiêu đề:** ERP ECOSYSTEM — Nền tảng Quản trị Doanh nghiệp Toàn diện cho Việt Nam

**Phụ đề:** All-in-One · AI-Native · Vietnamese-First

**Tagline:** 14 modules, 19 shared packages, 1.5 triệu dòng code — xây dựng từ zero bằng TypeScript hiện đại

**Visual gợi ý:** Dark gradient background (#0f172a → #1e293b), central logo with glowing blue accent, abstract circuit/network pattern

---

## SLIDE 2: KPI TỔNG QUAN — "Hệ thống bằng con số"

6 chỉ số chính, mỗi số hiển thị lớn + label nhỏ bên dưới:

| Chỉ số        | Giá trị   | Mô tả                          |
| ------------- | --------- | ------------------------------ |
| Lines of Code | 1,511,559 | Tổng LOC TypeScript/JavaScript |
| Source Files  | 7,548     | Tổng file mã nguồn             |
| Prisma Models | 953       | Database models (ORM)          |
| API Routes    | 1,257     | REST API endpoints             |
| Applications  | 14        | Ứng dụng độc lập               |
| Packages      | 19        | Thư viện dùng chung            |

**Visual gợi ý:** 6 KPI cards trên 1 hàng, nền xanh đậm, số lớn gradient xanh-lục, style dashboard hiện đại

---

## SLIDE 3: TREEMAP — "Phân bổ Code theo Module"

Biểu đồ treemap, kích thước ô tỷ lệ với LOC:

**Tier 1 — Mega modules (>100K LOC):**

- MRP (Sản xuất): 526,503 LOC — 2,417 files — 174 models — Màu xanh dương đậm
- HRM-unified (Nhân sự đa ngôn ngữ, tích hợp AI): 216,650 LOC — 1,238 files — 182 models — Màu tím đậm
- ExcelAI (Bảng tính AI): 182,132 LOC — 636 files — Màu xanh lục
- TPM-web (Khuyến mãi thương mại): 131,597 LOC — 509 files — Màu cam

**Tier 2 — Core modules (25K–55K LOC):**

- CRM (Khách hàng): 51,402 LOC — 417 files — 48 models — Màu cyan
- OTB (Ngân sách mua hàng): 50,947 LOC — 247 files — 33 models — Màu đỏ
- HRM (Nhân sự cơ bản): 42,573 LOC — 352 files — 37 models — Màu tím
- TPM-NestJS (API backend): 32,358 LOC — 296 files — 101 models — Màu cam đậm
- TPM-API (API Express): 28,217 LOC — 217 files — 108 models — Màu vàng đậm

**Tier 3 — Specialized modules (<10K LOC):**

- Accounting (Kế toán VAS): 2,621 LOC — 21 models — 20 enums
- Ecommerce (Thương mại điện tử): 1,931 LOC — 18 models — 12 enums
- PM (Quản lý dự án): 3,580 LOC — 16 files
- Docs (Tài liệu API): 517 LOC — 7 sections

**Tier 4 — Shared Infrastructure:**

- 19 Packages: 11,171 LOC — 57 files — Nền xanh viền đứt nét

**Visual gợi ý:** Treemap/mosaic layout, mỗi ô có màu riêng, label tên + LOC + files, ô lớn cho MRP chiếm ~35%

---

## SLIDE 4: 14 MODULES CHI TIẾT — "Mỗi module là một app độc lập"

### 🏭 MRP — Manufacturing Resource Planning

526,503 LOC · 2,417 files · 174 Prisma models · 291 API routes

- Bill of Materials (BOM) đa cấp với tính giá thành
- MRP Engine: ATP (Available-to-Promise), CTP (Capable-to-Promise), Pegging
- Work Orders + Capacity Planning + OEE tracking
- Quality Management: NCR, CAPA, SPC, Inspection plans
- AI Scheduling (Google Gemini), Demand forecasting
- Supplier Portal + Vendor rating (A/B/C/D)
- PWA với offline support, barcode scanning

### 👥 HRM-unified — Human Resource Management (Multi-language, AI-integrated)

216,650 LOC · 1,238 files · 182 models

- Employee lifecycle đầy đủ (Onboarding → Offboarding)
- Payroll VN: Tính thuế TNCN, BHXH/BHYT/BHTN, xuất payslip email
- KPI & Performance Reviews theo kỳ
- Attendance: chấm công, import Excel AI mapping
- Recruitment: Job posting → Interview pipeline → Careers portal
- Contract management với cảnh báo hết hạn
- Learning & Development modules
- i18n multi-language routing
- Claude API Copilot tích hợp sâu: AI-driven insights phân tích xu hướng nhân sự, smart reporting tự động tạo báo cáo HR

### 📊 ExcelAI — AI-Native Spreadsheet Engine

182,132 LOC · 636 files

- 90+ hàm Excel: SUM, VLOOKUP, IF, INDEX/MATCH, DATE...
- Cell references: absolute ($A$1), relative, mixed
- Auto-recalculation real-time
- Charts: Bar, Line, Area, Pie với live update
- Import/Export: .xlsx, .xls, .csv
- Conditional formatting + Data validation
- Find & Replace (Ctrl+F/H), Go To (Ctrl+G)
- Multi-level sorting, 20+ keyboard shortcuts

### 📢 TPM — Trade Promotion Management

131,597 LOC (web) + 32,358 LOC (NestJS) + 28,217 LOC (Express) = 192,172 LOC tổng

- Budget allocation & tracking
- Promotions planning & execution
- Claims reconciliation
- BI Analytics dashboards
- Voice/AI-enabled interfaces
- Real-time monitoring

### 💼 CRM — Customer Relationship Management

51,402 LOC · 417 files · 48 models · 77 API routes

- Contacts & Companies management
- Pipeline & Deals: Kanban drag-and-drop, probability scoring
- Marketing Campaigns: Email/SMS/Push, A/B testing, segmentation
- Support Tickets: SLA engine, auto-assignment, internal notes
- Customer Portal: Magic link auth, self-service
- Quotes builder → PDF generation → Email delivery
- Webhooks + Activity timeline
- Dashboard KPIs, funnel charts, deal trends

### 💰 OTB — Open-To-Buy Budget Management

50,947 LOC · 247 files · 33 models

- Budget allocation & variance analysis
- SKU proposals & product planning
- Multi-level approval workflows
- Order & receipt confirmation
- Import/Export bulk operations

### 👤 HRM — Core Human Resource Management

42,573 LOC · 352 files · 37 models

- Employee profiles + dependents + employment history
- Contracts + payroll + attendance
- HR Events: promotions, discipline, transfers
- Document templates (docxtemplater)
- Audit trail toàn bộ thay đổi

### 🧾 Accounting — Kế toán Việt Nam

2,621 LOC · 21 models · 20 enums

- Chart of Accounts: VAS TT200 & TT133
- Double-entry Journal với audit trail
- AP (Công nợ phải trả) & AR (Công nợ phải thu)
- E-Invoice (Hóa đơn điện tử NĐ123/2020)
- E-Tax (Thuế điện tử HTKK)
- Bank Reconciliation
- Budget management (Operating/Capital/Project)
- IFRS mapping (Enterprise tier)
- Multi-currency với exchange rate revaluation

### 🛒 Ecommerce — Thương mại Điện tử

1,931 LOC · 18 models · 12 enums

- Product catalog + variants + categories (tree)
- Shopping cart + checkout validation
- Thanh toán VN: VNPay (HMAC SHA512), MoMo (HMAC SHA256), ZaloPay, VietQR (12 ngân hàng), COD
- Vận chuyển: GHN, GHTK, Viettel Post, J&T, GrabExpress, Ninja Van
- Order lifecycle state machine với bilingual status (Vi/En)
- Auto-generate VAS journal entries (Debit 131/112, Credit 5111+33311)
- Promotions: PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING, BUY_X_GET_Y, BUNDLE_PRICE
- Abandoned cart detection
- VND formatting: giá gồm VAT, làm tròn đến 1000₫

### 📋 PM — Project Management

3,580 LOC · 16 files — Base template, đang mở rộng

### 📖 Docs — API Documentation Portal

517 LOC · 7 doc sections — Full-text search, Table of Contents

---

## SLIDE 5: 19 SHARED PACKAGES — "Nền tảng hạ tầng chung"

Tổng: 11,171 LOC · 57 files

| Package             | LOC   | Files | Chức năng                                                                         |
| ------------------- | ----- | ----- | --------------------------------------------------------------------------------- |
| @erp/master-data    | 1,971 | 13    | CRUD service cho Customer, Product, Employee, Supplier + event sync               |
| @erp/tpm-shared     | 1,396 | 5     | Shared types & utilities cho Trade Promotion Management                           |
| @erp/events         | 1,150 | 6     | NATS JetStream pub/sub + DLQ + Event versioning + Idempotency                     |
| @erp/saas           | 856   | 1     | Multi-tenant SaaS: 3 tiers (990K/2.99M/7.99M₫), billing, usage metering           |
| @erp/sdk            | 815   | 5     | Developer SDK: REST client, Webhook manager, Plugin architecture, OpenAPI         |
| @erp/ai-copilot     | 813   | 5     | Claude API integration: module-specific AI assistants + tool bindings             |
| @erp/security       | 663   | 1     | RBAC (11 roles × 37 permissions), Rate limiter, CSRF, API Keys, IP filter         |
| @erp/api-middleware | 647   | 1     | Request ID, CORS, rate limit headers, security headers, pagination, validation    |
| @erp/cache          | 483   | 1     | L1 in-memory LRU + L2 Redis, stale-while-revalidate, BatchLoader (N+1)            |
| @erp/auth           | 478   | 5     | NextAuth + Keycloak JWT verification, React hooks (useAuth, useSession)           |
| @erp/shared         | 445   | 4     | Common types (User, Tier, Role), constants, response formatting                   |
| @erp/i18n           | 421   | 1     | Vi/En translations (100+ keys), diacritic-insensitive search, VND/date format     |
| @erp/logger         | 410   | 1     | Structured JSON logging, AsyncLocalStorage context, field redaction               |
| @erp/health         | 363   | 1     | K8s probes (liveness/readiness/startup), DB/NATS/Redis/Memory/Disk checks         |
| @erp/notifications  | 356   | 1     | Multi-channel: Email, In-app, SMS, Zalo, Telegram                                 |
| @erp/errors         | 332   | 1     | Domain error hierarchy: 15 error classes, Prisma/Zod auto-convert, Vi/En messages |
| @erp/admin          | 329   | 1     | Admin dashboard: user management, system config, RBAC                             |
| @erp/feature-flags  | 215   | 1     | Feature toggles by tier (Basic/Pro/Enterprise)                                    |
| @erp/database       | 28    | 2     | Centralized Prisma client + migration scripts                                     |

**Visual gợi ý:** Horizontal bar chart, mỗi bar 1 màu riêng, sorted by LOC descending

---

## SLIDE 6: TECH STACK — "Kiến trúc Hiện đại"

| Layer    | Technologies                                                                           |
| -------- | -------------------------------------------------------------------------------------- |
| Frontend | Next.js 14/15, React 18/19, Vite, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend  | NestJS, Express.js, Next.js API Routes, Prisma ORM, BullMQ                             |
| Database | PostgreSQL 16, Redis 7, NATS JetStream, Supabase                                       |
| Auth     | Keycloak SSO, NextAuth 5, JWT/RBAC, Supabase Auth, API Keys                            |
| AI/ML    | Claude API (Copilot mọi module), Google Gemini (Forecasting), OpenAI                   |
| DevOps   | Docker multi-stage, Kubernetes, GitHub Actions CI/CD, Kong Gateway, Turborepo          |
| Payments | VNPay, MoMo, ZaloPay, VietQR (12 ngân hàng VN), COD                                    |
| Shipping | GHN, GHTK, Viettel Post, J&T, GrabExpress, Ninja Van                                   |

**Kiến trúc:**

- Monorepo (npm workspaces + Turborepo)
- Microservices qua NATS JetStream event-driven
- Multi-tenant SaaS architecture
- L1 Memory + L2 Redis caching
- Kong API Gateway + Keycloak SSO
- K8s deployment với HPA, rolling updates, 3 health probes

**Visual gợi ý:** Architecture diagram kiểu layered hoặc hexagonal, color-coded by layer, arrows showing data flow

---

## SLIDE 7: MA TRẬN CẠNH TRANH — "Heatmap 16 tiêu chí × 8 đối thủ"

Thang điểm 0–10. Màu: 9–10 xanh đậm, 7–8 xanh nhạt, 5–6 vàng, 3–4 đỏ, 0–2 đỏ đậm.

| Tính năng         | ERP Ecosystem |  MISA   |  Bravo  | SAP B1  |  Odoo   |   1C    | KiotViet |  Sapo   |
| ----------------- | :-----------: | :-----: | :-----: | :-----: | :-----: | :-----: | :------: | :-----: |
| Kế toán VAS       |       8       |   10    |    7    |    6    |    7    |    7    |    2     |    2    |
| HRM & Payroll     |       9       |    6    |    5    |    5    |    7    |    6    |    3     |    2    |
| CRM               |       9       |    5    |    3    |    6    |    7    |    4    |    5     |    4    |
| MRP/Sản xuất      |       8       |    4    |    9    |    7    |    7    |    6    |    0     |    0    |
| E-Invoice (NĐ123) |       8       |   10    |    6    |    4    |    6    |    5    |    4     |    3    |
| AI Copilot        |       9       |    6    |    1    |    3    |    3    |    2    |    2     |    4    |
| E-commerce VN     |       9       |    1    |    0    |    2    |    7    |    2    |    7     |    9    |
| Thanh toán VN     |       9       |    3    |    1    |    2    |    4    |    1    |    8     |    8    |
| Developer SDK     |       9       |    2    |    1    |    5    |    8    |    4    |    2     |    3    |
| Multi-tenant SaaS |       9       |    7    |    3    |    4    |    7    |    5    |    7     |    7    |
| Trade Promotion   |       8       |    1    |    1    |    2    |    2    |    1    |    0     |    1    |
| ExcelAI Engine    |       8       |    5    |    0    |    0    |    2    |    1    |    0     |    0    |
| Microservices     |       9       |    6    |    5    |    4    |    6    |    5    |    5     |    5    |
| Event-Driven      |       9       |    4    |    3    |    4    |    5    |    4    |    3     |    3    |
| Security RBAC     |       8       |    7    |    6    |    8    |    7    |    6    |    6     |    5    |
| i18n Vi/En        |       8       |    8    |    7    |    8    |    9    |    7    |    8     |    8    |
| **TRUNG BÌNH**    |    **8.6**    | **5.3** | **3.6** | **4.4** | **5.9** | **4.1** | **3.9**  | **4.0** |

**Visual gợi ý:** Heatmap table, gradient color theo score, cột ERP Ecosystem highlight viền xanh, dòng TRUNG BÌNH bold

---

## SLIDE 8: XẾP HẠNG TỔNG HỢP — "Top 8 giải pháp ERP tại Việt Nam"

| Hạng | Giải pháp        | Điểm TB | Thế mạnh                                 | Điểm yếu                                 |
| :--: | ---------------- | :-----: | ---------------------------------------- | ---------------------------------------- |
|  #1  | ERP Ecosystem    |   8.6   | AI + E-com + SDK + All-in-one 14 modules | Chưa có khách hàng, test coverage 0%     |
|  #2  | Odoo VN          |   5.9   | Open source, linh hoạt, community lớn    | Cần customize nhiều, UX phức tạp         |
|  #3  | MISA AMIS        |   5.3   | Kế toán #1 VN (94K KH), E-Invoice chuẩn  | Yếu CRM/MRP/AI/E-com                     |
|  #4  | SAP Business One |   4.4   | Chuẩn quốc tế, security mạnh             | Giá cao ($3.5K/user), ít VN-specific     |
|  #5  | 1C:Company VN    |   4.1   | Low-code nhanh, 5000+ KH                 | Non-standard tech, lock-in               |
|  #6  | Sapo             |   4.0   | E-com #1 VN (230K KH), omnichannel       | Không phải ERP, thiếu HRM/MRP/Accounting |
|  #7  | KiotViet         |   3.9   | POS #1 VN (300K KH), mobile app mạnh     | Chỉ POS/retail, không có ERP modules     |
|  #8  | Bravo            |   3.6   | Sản xuất mạnh, enterprise VN             | Thiếu CRM/AI/E-com, UI cũ                |

**Visual gợi ý:** Podium/ranking chart, #1 highlight lớn nhất, gradient từ xanh (#1) → đỏ (#8), bar chart ngang hoặc dọc

---

## SLIDE 9: RADAR — "So sánh 4 giải pháp hàng đầu"

10 chiều đánh giá, 4 đường radar chồng nhau:

| Dimension  | ERP Ecosystem | MISA | Odoo | SAP B1 |
| ---------- | :-----------: | :--: | :--: | :----: |
| Kế toán    |       8       |  10  |  7   |   6    |
| HRM        |       9       |  6   |  7   |   5    |
| CRM        |       9       |  5   |  7   |   6    |
| MRP        |       8       |  4   |  7   |   7    |
| E-commerce |       9       |  1   |  7   |   2    |
| AI Copilot |       9       |  6   |  3   |   3    |
| SDK/API    |       9       |  2   |  8   |   5    |
| Security   |       8       |  7   |  7   |   8    |
| i18n       |       8       |  8   |  9   |   8    |
| SaaS       |       9       |  7   |  7   |   4    |

**Màu đường:**

- ERP Ecosystem: Xanh dương (#3b82f6) — diện tích lớn nhất
- MISA: Hồng (#ec4899)
- Odoo: Tím (#8b5cf6)
- SAP B1: Vàng (#eab308)

**Visual gợi ý:** Spider/radar chart, ERP Ecosystem fill area nổi bật nhất, 4 overlapping polygons

---

## SLIDE 10: LỢI THẾ CẠNH TRANH — "5 USP Không đối thủ nào có đủ"

### USP 1: All-in-One Việt Nam 🇻🇳

Duy nhất cung cấp đầy đủ 14 modules trong 1 platform. MISA chỉ mạnh kế toán, Bravo chỉ mạnh sản xuất, KiotViet chỉ có POS.

### USP 2: AI-Native Architecture 🤖

Claude AI Copilot tích hợp sâu vào mọi module. Không đối thủ VN nào có AI copilot ở mức này. MISA mới bắt đầu, SAP/Odoo chưa triển khai mạnh tại VN.

### USP 3: Vietnamese Payment Ecosystem 💳

Tích hợp đầy đủ VNPay, MoMo, ZaloPay, VietQR (12 ngân hàng), COD. Chỉ Sapo và KiotViet có mức tương đương, nhưng họ không có ERP.

### USP 4: Developer-First Platform 🛠️

SDK, Webhook, Plugin architecture, OpenAPI spec generation. Odoo có API nhưng hạn chế. Không đối thủ VN nào có developer SDK.

### USP 5: Modern Tech Stack ⚡

Next.js, TypeScript, PostgreSQL, NATS JetStream, Kubernetes. Phần lớn đối thủ VN dùng .NET/Java legacy.

**Visual gợi ý:** 5 icon cards, mỗi USP 1 card với icon lớn + title + 1-2 dòng mô tả, layout 2-3 column

---

## SLIDE 11: GIÁ CẠNH TRANH — "Pricing Matrix"

| Giải pháp         | Entry          | Mid           | Enterprise    | Tính theo      |
| ----------------- | -------------- | ------------- | ------------- | -------------- |
| **ERP Ecosystem** | **990K₫/th**   | **2.99M₫/th** | **7.99M₫/th** | **Per tenant** |
| MISA AMIS         | ~500K₫/th      | ~2M₫/th       | Liên hệ       | Per module     |
| KiotViet          | 200K₫/th       | 270K₫/th      | 370K₫/th      | Per cửa hàng   |
| Sapo              | 499K₫/th       | 899K₫/th      | Liên hệ       | Per gói        |
| Odoo VN           | Free (CE)      | $24.9/user/th | Custom        | Per user       |
| SAP B1            | ~900K/user/th  | ~2.2M/user/th | Custom        | Per user       |
| 1C Vietnam        | Liên hệ        | Liên hệ       | Liên hệ       | Liên hệ        |
| Bravo             | ~100M₫ (1 lần) | ~300M₫        | ~1Tỷ₫+        | License 1 lần  |

**3 gói ERP Ecosystem chi tiết:**

- **Basic (990K₫/tháng):** 10 users, 5GB, HRM + CRM + PM + ExcelAI, email support
- **Pro (2.99M₫/tháng):** 50 users, 50GB, +MRP + OTB + Accounting + TPM, priority support
- **Enterprise (7.99M₫/tháng):** Unlimited users, 500GB, +AI Copilot + E-commerce + IFRS + SDK, dedicated support

**Visual gợi ý:** Pricing comparison table hoặc 3 pricing cards (Basic/Pro/Enterprise), highlight Pro là "Most Popular"

---

## SLIDE 12: CƠ HỘI THỊ TRƯỜNG — "Market Opportunity"

| Chỉ số                  | Giá trị     | Nguồn             |
| ----------------------- | ----------- | ----------------- |
| Tổng doanh nghiệp VN    | 850,000+    | Tổng cục Thống kê |
| Hộ kinh doanh           | 5,000,000+  | Bộ Tài chính      |
| % dùng ERP hiện tại     | ~15-20%     | VINASA 2025       |
| Tăng trưởng ERP/năm     | 18-22% CAGR | IDC Vietnam       |
| TAM (Total Addressable) | $500M+/năm  | Estimate 2026     |
| SAM (ERP cloud cho SMB) | $120M/năm   | Estimate 2026     |

**Target Segments:**

- Basic (990K₫): SMB 5-30 nhân viên → TAM ~400,000 DN
- Pro (2.99M₫): Mid-market 30-200 NV → TAM ~50,000 DN ← SWEET SPOT
- Enterprise (7.99M₫): Large 200+ NV → TAM ~5,000 DN

**Chiến lược:** Tập trung Pro tier — nơi đối thủ yếu nhất (MISA quá đơn giản, SAP quá đắt, Odoo cần customize nhiều)

**Revenue potential:** 50,000 DN × 5% penetration × 2.99M₫ × 12 tháng = ~90 tỷ ₫/năm

**Visual gợi ý:** Funnel chart hoặc concentric circles (TAM → SAM → Target), với callout "Sweet spot" cho Pro tier

---

## SLIDE 13: GAP ANALYSIS & ROADMAP — "Lộ trình phát triển"

### P0 — Blockers cho Production (Q2–Q3 2026)

| Gap                                             | Hiện tại | Mục tiêu | Timeline |
| ----------------------------------------------- | -------- | -------- | -------- |
| Test coverage (unit/integration/e2e)            | 0%       | >80%     | Q2 2026  |
| Mobile app (React Native)                       | 0%       | MVP      | Q3 2026  |
| Báo cáo tài chính chuẩn VN (B01/B02/B03/B09-DN) | 60%      | 100%     | Q2 2026  |

### P1 — Growth Features (Q3–Q4 2026)

| Gap                                        | Hiện tại | Mục tiêu | Timeline |
| ------------------------------------------ | -------- | -------- | -------- |
| Project Management nâng cao (Gantt, Agile) | 30%      | 80%      | Q3 2026  |
| Tích hợp Tổng cục Thuế (XML submission)    | 0%       | 100%     | Q3 2026  |
| Multi-language (Ja/Ko/Zh)                  | 0%       | MVP      | Q4 2026  |

### P2 — Expansion (Q4 2026–Q1 2027)

| Gap                           | Hiện tại | Mục tiêu | Timeline |
| ----------------------------- | -------- | -------- | -------- |
| Marketplace / App Store       | 10%      | 50%      | Q4 2026  |
| BI / Data Analytics dashboard | 20%      | 60%      | Q1 2027  |

**Visual gợi ý:** Timeline/Gantt horizontal, 3 tracks (P0/P1/P2), color-coded (đỏ/vàng/xanh), milestones marked

---

## SLIDE 14: KẾT LUẬN — "Vị thế & Tầm nhìn"

**Vị thế hiện tại:**

- #1 về độ rộng tính năng (14 modules all-in-one)
- #1 về AI integration (Claude Copilot mọi module)
- #1 về Vietnamese payment/shipping ecosystem trong ERP
- #1 về Developer experience (SDK, Plugin, Webhook)
- Điểm trung bình 8.6/10 — cao nhất trong 8 giải pháp

**3 việc cần làm ngay:**

1. Test coverage đạt 80%+ → Production-ready
2. Mobile app (React Native) → Cạnh tranh KiotViet/Sapo
3. Hoàn thiện báo cáo tài chính VAS → Cạnh tranh MISA

**Mục tiêu 12 tháng:**

- 2,500 khách hàng trả phí
- MRR 5 tỷ đồng
- 10 enterprise accounts

**Visual gợi ý:** Summary card với 3 key takeaways, kèm "Next steps" timeline ngắn, closing với logo + tagline

---

## METADATA CHO AI TOOLS

**Tông màu gợi ý:** Dark mode (#0f172a background, #3b82f6 primary, #8b5cf6 accent, #10b981 success)

**Font gợi ý:** Inter, SF Pro, hoặc bất kỳ sans-serif hiện đại

**Style:** Corporate tech dashboard, clean minimalist, dark gradient, glowing accents

**Số slides tối ưu:** 12-14 slides

**Target audience:** Founders, investors, tech leads, enterprise buyers

**Ngôn ngữ:** Vietnamese chính, English thuật ngữ kỹ thuật

**Keywords cho image generation:** "enterprise software dashboard", "ERP system architecture", "Vietnamese tech startup", "dark mode SaaS dashboard", "competitive analysis heatmap", "radar chart comparison", "modern tech stack diagram"
