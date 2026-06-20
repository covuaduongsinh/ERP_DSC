# Database Schemas Overview / Tổng quan Schemas Cơ sở dữ liệu

Tài liệu này mô tả cấu trúc schema của từng module trong VietERP Platform.

This document describes the schema structure of each module in VietERP Platform.

---

## Public Schema (Shared Master Data) / Schema Công cộng (Dữ liệu Chính)

**Location:** `packages/database/prisma/schema.prisma`

### Multi-Tenancy Entities

#### Tenant / Đối tượng Tenant

```
- id (String) — Unique identifier (CUID)
- name (String) — Tenant name
- slug (String) — URL-safe slug (unique)
- tier (Tier) — BASIC | PRO | ENTERPRISE
- isActive (Boolean) — Active status
- settings (Json) — Custom settings object
- createdAt (DateTime) — Creation timestamp
- updatedAt (DateTime) — Last update timestamp
```

#### User / Người dùng

```
- id (String) — Unique identifier
- email (String) — Email address
- name (String) — Full name
- role (UserRole) — ADMIN | MANAGER | USER | VIEWER
- avatar (String?) — Profile avatar URL
- isActive (Boolean) — Active status
- keycloakId (String?) — Keycloak SSO integration
- tenantId (String) — Tenant foreign key
- createdAt, updatedAt (DateTime)

Relationships:
  - tenant: Tenant (many-to-one)
  - auditLogs: AuditLog[] (one-to-many)
```

### Master Data Entities

#### Customer / Khách hàng

```
- id (String) — Unique identifier
- code (String) — Customer code (unique per tenant)
- name (String) — Full name
- email (String?) — Email address
- phone (String?) — Phone number
- taxCode (String?) — Tax ID
- type (CustomerType) — INDIVIDUAL | COMPANY
- status (EntityStatus) — ACTIVE | INACTIVE | DISCONTINUED
- address (Json?) — Address object (street, city, province, country)
- tenantId (String) — Multi-tenant identifier
- createdBy (String?) — Creator user ID
- createdAt, updatedAt, deletedAt (DateTime)

Relationships:
  - tenant: Tenant (many-to-one)

Indexes:
  - unique(code, tenantId)
  - index(tenantId, status)
```

#### Product / Sản phẩm

```
- id (String) — Unique identifier
- code (String) — Product SKU (unique per tenant)
- name (String) — Product name
- description (String?) — Product description
- unit (String) — Unit of measure (PCS, BOX, KG, etc.)
- category (String?) — Product category
- price (Decimal) — Selling price
- cost (Decimal) — Cost price
- status (EntityStatus) — Product status
- tenantId (String) — Tenant identifier
- createdBy (String?) — Creator user ID
- createdAt, updatedAt, deletedAt (DateTime)

Indexes:
  - unique(code, tenantId)
  - index(tenantId, status)
```

#### Employee / Nhân viên

```
- id (String) — Unique identifier
- code (String) — Employee ID (unique per tenant)
- name (String) — Full name
- email (String) — Email address (unique per tenant)
- phone (String?) — Phone number
- department (String?) — Department name/code
- position (String?) — Job position
- hireDate (DateTime) — Employment start date
- status (EntityStatus) — ACTIVE | INACTIVE | TERMINATED
- tenantId (String) — Tenant identifier
- createdBy (String?) — Creator user ID
- createdAt, updatedAt, deletedAt (DateTime)

Indexes:
  - unique(code, tenantId)
  - unique(email, tenantId)
  - index(tenantId, status)
```

#### Supplier / Nhà cung cấp

```
- id (String) — Unique identifier
- code (String) — Supplier code (unique per tenant)
- name (String) — Supplier name
- email (String?) — Email address
- phone (String?) — Contact phone
- taxCode (String?) — Tax ID
- bankAccount (String?) — Bank account number
- bankName (String?) — Bank name
- address (Json?) — Address object
- contactPerson (String?) — Primary contact
- paymentTermDays (Int) — Standard payment terms (default: 30)
- rating (Float?) — Supplier rating (0-5)
- status (EntityStatus) — Supplier status
- tenantId (String) — Tenant identifier
- createdBy (String?) — Creator user ID
- createdAt, updatedAt, deletedAt (DateTime)

Indexes:
  - unique(code, tenantId)
  - index(tenantId, status)
```

#### Warehouse / Kho hàng

```
- id (String) — Unique identifier
- code (String) — Warehouse code (unique per tenant)
- name (String) — Warehouse name
- address (String?) — Warehouse address
- managerId (String?) — Warehouse manager user ID
- status (EntityStatus) — ACTIVE | INACTIVE
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(code, tenantId)
  - index(tenantId)
```

#### Unit of Measure / Đơn vị đo

```
- id (String) — Unique identifier
- code (String) — Unit code (unique per tenant)
- name (String) — Unit name (PCS, BOX, KG, M, etc.)
- description (String?) — Unit description
- conversionFactor (Float) — Conversion to base unit
- baseUnitId (String?) — Base unit reference for conversion
- tenantId (String) — Tenant identifier
- isActive (Boolean) — Active status
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(code, tenantId)
```

### System Entities

#### AuditLog / Bản ghi Kiểm toán

```
- id (String) — Unique identifier
- action (String) — CREATE | UPDATE | DELETE | RESTORE
- entity (String) — Table name (customer, product, etc.)
- entityId (String) — Record ID being modified
- changes (Json?) — { field: { old: oldValue, new: newValue } }
- userId (String) — User performing action
- tenantId (String) — Tenant identifier
- ipAddress (String?) — IP address of request
- userAgent (String?) — Browser/client user agent
- createdAt (DateTime) — Timestamp of change

Relationships:
  - user: User (many-to-one)

Indexes:
  - index(tenantId, entity, entityId)
  - index(tenantId, createdAt)
```

#### MasterDataChangeLog / Bản ghi Thay đổi Dữ liệu Chính

```
- id (String) — Unique identifier
- entity (String) — customer, product, employee, supplier
- entityId (String) — Record ID
- action (String) — create, update, delete, restore
- changes (Json?) — Detailed changes object
- sourceModule (String) — hrm, crm, mrp, master-data
- userId (String) — User making change
- tenantId (String) — Tenant identifier
- version (Int) — Change version (default: 1)
- createdAt (DateTime) — Timestamp

Indexes:
  - index(tenantId, entity, entityId)
  - index(tenantId, createdAt)
  - index(sourceModule)
```

#### FeatureFlag / Cờ Tính năng

```
- id (String) — Unique identifier
- key (String) — Feature flag key (unique)
- name (String) — Human-readable name
- description (String?) — Feature description
- enabledTiers (Tier[]) — BASIC | PRO | ENTERPRISE
- isEnabled (Boolean) — Global enable/disable
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(key)
```

---

## Accounting Schema / Schema Kế toán

**Location:** `apps/Accounting/prisma/schema.prisma`

### Chart of Accounts

#### Account / Tài khoản

```
- id (String) — Unique identifier
- accountNumber (String) — VAS account code (111, 1111, 131)
- name (String) — Vietnamese account name
- nameEn (String?) — English name for IFRS reporting
- description (String?) — Account description
- accountType (AccountType) — ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE | CONTRA_ASSET | CONTRA_REVENUE
- accountGroup (AccountGroup) — GROUP_1 to GROUP_9 (VAS classification)
- normalBalance (NormalBalance) — DEBIT | CREDIT
- parentId (String?) — Parent account for hierarchy
- level (Int) — 1=group, 2=detail, 3=sub-detail
- isActive (Boolean) — Active status
- isSystemAccount (Boolean) — Cannot be deleted
- isBankAccount (Boolean) — Bank account flag
- currency (String) — VND, USD, etc. (default: VND)
- vasCode (String?) — Official VAS mapping code
- ifrsCode (String?) — IFRS mapping code
- tt200Code (String?) — Thông tư 200 reference
- tt133Code (String?) — Thông tư 133 reference
- openingBalance (Decimal) — Opening balance
- currentBalance (Decimal) — Current balance
- tenantId (String) — Tenant identifier
- createdBy, createdAt, updatedAt (DateTime)

Relationships:
  - parent: Account? (self-reference)
  - children: Account[] (self-reference)
  - journalLines: JournalLine[]
  - apInvoices: APInvoice[]
  - arInvoices: ARInvoice[]
  - budgetLines: BudgetLine[]

Indexes:
  - unique(accountNumber, tenantId)
  - index(tenantId, accountType)
  - index(tenantId, accountGroup)
```

### Fiscal Periods

#### FiscalYear / Năm Tài chính

```
- id (String) — Unique identifier
- year (Int) — Year number (2026)
- startDate, endDate (DateTime) — Fiscal year period
- isCurrent (Boolean) — Current fiscal year
- status (FiscalStatus) — OPEN | CLOSED | LOCKED
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Relationships:
  - periods: FiscalPeriod[]

Indexes:
  - unique(year, tenantId)
```

#### FiscalPeriod / Kỳ Kế toán

```
- id (String) — Unique identifier
- fiscalYearId (String) — Fiscal year reference
- period (Int) — 1-12 for months, 13 for closing
- name (String) — Tháng 1/2026, Kỳ kết chuyển
- startDate, endDate (DateTime) — Period dates
- status (PeriodStatus) — OPEN | SOFT_CLOSE | HARD_CLOSE | REOPENED
- closedAt (DateTime?) — Closure timestamp
- closedBy (String?) — User who closed
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Relationships:
  - fiscalYear: FiscalYear
  - journalEntries: JournalEntry[]

Indexes:
  - unique(fiscalYearId, period)
  - index(tenantId, status)
```

### Journal Entries

#### JournalEntry / Bút toán

```
- id (String) — Unique identifier
- entryNumber (String) — Auto-generated: JV-2026-000001
- fiscalPeriodId (String) — Period reference
- description (String) — Entry description
- reference (String?) — Supporting document reference
- entryDate (DateTime) — Transaction date
- status (EntryStatus) — DRAFT | POSTED | ADJUSTED
- currencyCode (String) — Currency (VND, USD)
- baseCurrencyRate (Decimal?) — Exchange rate
- sourceModule (String) — hrm, crm, mrp, ecommerce (auto-posting source)
- sourceDocumentId (String?) — Link to source document
- tenantId (String) — Tenant identifier
- createdBy (String?) — Creator
- createdAt, updatedAt (DateTime)

Relationships:
  - fiscalPeriod: FiscalPeriod
  - lines: JournalLine[]
  - attachments: Attachment[]

Indexes:
  - unique(entryNumber, tenantId)
  - index(tenantId, entryDate)
  - index(tenantId, status)
  - index(sourceModule, sourceDocumentId)
```

#### JournalLine / Dòng Bút toán

```
- id (String) — Unique identifier
- journalEntryId (String) — Entry reference
- accountId (String) — Account reference
- debitAmount (Decimal) — Debit amount (VND)
- creditAmount (Decimal) — Credit amount (VND)
- description (String?) — Line description
- reference (String?) — Cross reference
- lineNumber (Int) — Line sequence
- costCenter (String?) — Cost center code
- department (String?) — Department code
- tenantId (String) — Tenant identifier
- createdAt (DateTime)

Relationships:
  - journalEntry: JournalEntry
  - account: Account

Indexes:
  - index(tenantId, accountId)
  - index(journalEntryId)
```

### Invoices

#### APInvoice / Hoá đơn Mua hàng

```
- id (String) — Unique identifier
- invoiceNumber (String) — Supplier invoice number (unique per tenant)
- supplierId (String) — Supplier reference
- invoiceDate (DateTime) — Invoice date
- dueDate (DateTime?) — Payment due date
- amount (Decimal) — Total amount
- discountAmount (Decimal?) — Discount
- taxAmount (Decimal) — Tax amount
- status (InvoiceStatus) — DRAFT | RECEIVED | MATCHED | POSTED | CANCELLED
- glAccountId (String) — GL account for posting
- tenantId (String) — Tenant identifier
- createdAt, updatedAt, deletedAt (DateTime)

Relationships:
  - supplier: Supplier
  - glAccount: Account
  - lines: APInvoiceLine[]
  - journalEntries: JournalEntry[]

Indexes:
  - unique(invoiceNumber, tenantId)
  - index(tenantId, status)
  - index(supplierId, invoiceDate)
```

#### ARInvoice / Hoá đơn Bán hàng

```
- id (String) — Unique identifier
- invoiceNumber (String) — Invoice number (unique per tenant)
- customerId (String) — Customer reference
- invoiceDate (DateTime) — Invoice date
- dueDate (DateTime?) — Payment due date
- amount (Decimal) — Total amount
- discountAmount (Decimal?) — Discount
- taxAmount (Decimal) — Tax amount (VAT)
- status (InvoiceStatus) — DRAFT | POSTED | PARTIALLY_PAID | PAID | OVERDUE | CANCELLED
- glAccountId (String) — GL account for posting
- tenantId (String) — Tenant identifier
- createdAt, updatedAt, deletedAt (DateTime)

Relationships:
  - customer: Customer
  - glAccount: Account
  - lines: ARInvoiceLine[]
  - journalEntries: JournalEntry[]

Indexes:
  - unique(invoiceNumber, tenantId)
  - index(tenantId, status)
  - index(customerId, invoiceDate)
```

---

## CRM Schema / Schema CRM

**Location:** `apps/CRM/prisma/schema.prisma`

#### Lead / Cơ hội tiềm năng

```
- id (String) — Unique identifier
- leadNumber (String) — Auto-generated lead code
- companyName (String) — Company name
- contactName (String) — Contact person
- email (String?) — Email
- phone (String?) — Phone
- status (LeadStatus) — NEW | QUALIFIED | CONTACTED | INTERESTED | UNQUALIFIED | CONVERTED
- source (LeadSource) — WEBSITE | REFERRAL | CAMPAIGN | COLD_CALL | PARTNER
- value (Decimal?) — Estimated deal value
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(leadNumber, tenantId)
  - index(tenantId, status)
```

#### Contact / Liên hệ

```
- id (String) — Unique identifier
- firstName, lastName (String)
- email (String) — Email (unique per tenant)
- phone (String?)
- accountId (String?) — Associated account
- title (String?) — Job title
- status (ContactStatus) — ACTIVE | INACTIVE
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Relationships:
  - account: Account? (CRM Account, not GL Account)

Indexes:
  - unique(email, tenantId)
  - index(tenantId, status)
```

#### Opportunity / Cơ hội bán hàng

```
- id (String) — Unique identifier
- opportunityName (String) — Opportunity name
- accountId (String) — CRM Account reference
- stage (SalesStage) — PROSPECTING | PROPOSAL | NEGOTIATION | CLOSING | WON | LOST
- amount (Decimal) — Deal amount
- expectedCloseDate (DateTime?) — Expected closure date
- probability (Int) — Win probability (0-100)
- status (OpportunityStatus) — OPEN | CLOSED_WON | CLOSED_LOST
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Indexes:
  - index(tenantId, stage, status)
```

#### Activity / Hoạt động

```
- id (String) — Unique identifier
- activityType (ActivityType) — CALL | EMAIL | MEETING | TASK | NOTE
- subject (String)
- description (String?)
- relatedTo (String) — Lead, Contact, Opportunity, Account
- relatedToId (String)
- dueDate (DateTime?)
- status (ActivityStatus) — PENDING | COMPLETED | CANCELLED
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Indexes:
  - index(tenantId, relatedTo, relatedToId)
  - index(tenantId, status)
```

#### Campaign / Chiến dịch

```
- id (String) — Unique identifier
- campaignName (String)
- status (CampaignStatus) — PLANNING | ACTIVE | COMPLETED | CANCELLED
- startDate, endDate (DateTime)
- budget (Decimal?)
- description (String?)
- tenantId (String) — Tenant identifier
- createdAt, updatedAt (DateTime)

Indexes:
  - index(tenantId, status)
```

---

## Ecommerce Schema / Schema Thương mại Điện tử

**Location:** `apps/Ecommerce/prisma/schema.prisma`

#### Product / Sản phẩm

```
- id (String) — Unique identifier
- sku (String) — Stock keeping unit (unique)
- name (String)
- description (String?)
- categoryId (String)
- price (Decimal)
- cost (Decimal?)
- stock (Int) — Available quantity
- status (ProductStatus) — DRAFT | PUBLISHED | ARCHIVED
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - category: ProductCategory
  - orders: Order[] (through OrderItem)

Indexes:
  - unique(sku, tenantId)
  - index(tenantId, status)
```

#### Order / Đơn hàng

```
- id (String) — Unique identifier
- orderNumber (String) — Order number (unique per tenant)
- customerId (String) — Customer reference
- status (OrderStatus) — NEW | PROCESSING | SHIPPED | DELIVERED | CANCELLED | RETURNED
- totalAmount (Decimal)
- shippingAddress (Json)
- billingAddress (Json)
- paymentStatus (PaymentStatus) — PENDING | PAID | REFUNDED
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - customer: Customer
  - items: OrderItem[]
  - payments: Payment[]
  - shipments: Shipment[]

Indexes:
  - unique(orderNumber, tenantId)
  - index(tenantId, status, createdAt)
```

#### OrderItem / Hàng trong Đơn hàng

```
- id (String) — Unique identifier
- orderId (String)
- productId (String)
- quantity (Int)
- unitPrice (Decimal)
- totalPrice (Decimal)
- tenantId (String)
- createdAt (DateTime)

Relationships:
  - order: Order
  - product: Product
```

#### Cart / Giỏ hàng

```
- id (String) — Unique identifier
- customerId (String)
- items: CartItem[]
- totalAmount (Decimal)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - customer: Customer
  - items: CartItem[]
```

#### Payment / Thanh toán

```
- id (String) — Unique identifier
- orderId (String)
- amount (Decimal)
- method (PaymentMethod) — CREDIT_CARD | BANK_TRANSFER | CASH | MOBILE_WALLET
- status (PaymentStatus) — PENDING | COMPLETED | FAILED | REFUNDED
- transactionId (String?)
- tenantId (String)
- createdAt (DateTime)

Relationships:
  - order: Order
```

#### Shipment / Vận chuyển

```
- id (String) — Unique identifier
- orderId (String)
- trackingNumber (String?)
- carrier (String) — Shipping company
- status (ShipmentStatus) — PENDING | SHIPPED | IN_TRANSIT | DELIVERED | CANCELLED
- shippingDate (DateTime?)
- deliveryDate (DateTime?)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - order: Order
```

---

## HRM Schema / Schema Quản lý Nhân sự

**Location:** `apps/HRM-unified/prisma/schema.prisma`

#### Department / Phòng ban

```
- id (String) — Unique identifier
- code (String) — Department code (unique per tenant)
- name (String)
- managerId (String?) — Manager employee ID
- parentId (String?) — Parent department
- status (DepartmentStatus) — ACTIVE | INACTIVE
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - manager: Employee?
  - parent: Department?
  - employees: Employee[]

Indexes:
  - unique(code, tenantId)
```

#### Position / Chức danh

```
- id (String) — Unique identifier
- code (String) — Position code (unique per tenant)
- name (String)
- level (PositionLevel) — STAFF | JUNIOR | SENIOR | LEAD | MANAGER | DIRECTOR
- salary (Decimal?) — Base salary
- tenantId (String)
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(code, tenantId)
```

#### Attendance / Chấm công

```
- id (String) — Unique identifier
- employeeId (String)
- date (DateTime)
- checkIn (DateTime?)
- checkOut (DateTime?)
- status (AttendanceStatus) — PRESENT | ABSENT | LATE | EARLY_LEAVE | ON_LEAVE
- workingHours (Decimal)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - employee: Employee

Indexes:
  - unique(employeeId, date, tenantId)
  - index(tenantId, date)
```

#### Payroll / Bảng lương

```
- id (String) — Unique identifier
- payrollPeriod (String) — Year-month (2026-03)
- employeeId (String)
- baseSalary (Decimal)
- allowances (Decimal)
- deductions (Decimal)
- taxAmount (Decimal)
- netSalary (Decimal)
- status (PayrollStatus) — DRAFT | APPROVED | PROCESSED | PAID
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - employee: Employee

Indexes:
  - unique(payrollPeriod, employeeId, tenantId)
  - index(tenantId, status)
```

#### Leave / Phép nghỉ

```
- id (String) — Unique identifier
- employeeId (String)
- leaveType (LeaveType) — ANNUAL | SICK | UNPAID | MATERNITY | SABBATICAL
- startDate, endDate (DateTime)
- days (Decimal) — Number of days
- status (LeaveStatus) — PENDING | APPROVED | REJECTED | CANCELLED
- reason (String?)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - employee: Employee

Indexes:
  - index(tenantId, employeeId, status)
  - index(tenantId, startDate, endDate)
```

---

## MRP Schema / Schema Quản lý Sản xuất

**Location:** `apps/MRP/prisma/schema.prisma`

#### BOM (Bill of Materials) / Danh sách Vật liệu

```
- id (String) — Unique identifier
- code (String) — BOM code (unique per tenant)
- productId (String) — Parent product
- version (Int) — BOM version
- status (BOMStatus) — ACTIVE | OBSOLETE | DRAFT
- lines: BOMMaterialLine[]
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - product: Product
  - lines: BOMMaterialLine[]

Indexes:
  - unique(code, tenantId)
```

#### ProductionOrder / Lệnh sản xuất

```
- id (String) — Unique identifier
- poNumber (String) — PO number (unique per tenant)
- productId (String)
- quantity (Decimal)
- status (ProductionStatus) — PLANNED | STARTED | IN_PROGRESS | COMPLETED | CANCELLED
- startDate, endDate (DateTime?)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - product: Product
  - operations: ProductionOperation[]

Indexes:
  - unique(poNumber, tenantId)
  - index(tenantId, status)
```

#### QualityCheck / Kiểm chất lượng

```
- id (String) — Unique identifier
- productionOrderId (String)
- checkDate (DateTime)
- passedQuantity (Decimal)
- failedQuantity (Decimal)
- defectNotes (String?)
- status (QCStatus) — PASSED | FAILED | CONDITIONAL
- tenantId (String)
- createdAt (DateTime)

Relationships:
  - productionOrder: ProductionOrder
```

#### Inventory / Tồn kho

```
- id (String) — Unique identifier
- productId (String)
- warehouseId (String)
- quantity (Decimal)
- reorderLevel (Decimal)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Relationships:
  - product: Product
  - warehouse: Warehouse

Indexes:
  - unique(productId, warehouseId, tenantId)
```

#### Machine / Máy móc

```
- id (String) — Unique identifier
- code (String) — Machine code (unique per tenant)
- name (String)
- model (String?)
- status (MachineStatus) — OPERATIONAL | MAINTENANCE | BROKEN | DEPRECATED
- lastMaintenanceDate (DateTime?)
- nextMaintenanceDate (DateTime?)
- tenantId (String)
- createdAt, updatedAt (DateTime)

Indexes:
  - unique(code, tenantId)
  - index(tenantId, status)
```

---

## Enum Types Reference

### EntityStatus

```
ACTIVE — Đang hoạt động
INACTIVE — Không hoạt động
DISCONTINUED — Ngưng sản xuất
TERMINATED — Chấm dứt
```

### UserRole

```
ADMIN — Quản trị viên
MANAGER — Quản lý
USER — Người dùng thường
VIEWER — Chỉ xem
```

### Tier

```
BASIC — Gói cơ bản
PRO — Gói chuyên nghiệp
ENTERPRISE — Gói doanh nghiệp
```

## Foreign Key Relationships / Quan hệ Khóa ngoài

All relationships include:

- ON DELETE CASCADE for dependent records
- ON DELETE RESTRICT for master records
- Proper indexing on foreign keys for performance

## Performance Considerations / Xem xét Hiệu suất

1. All frequently queried fields have indexes
2. Multi-tenant filtering indexes for fast tenant isolation
3. Date-based indexes for reporting and period queries
4. Status fields indexed for workflow queries
5. Composite indexes for common filter combinations

Refer to [ER Diagram](./er-diagram.mermaid) for visual representation.
