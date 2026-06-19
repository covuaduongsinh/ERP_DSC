// ── OpenAPI 3.0 Specification for Cờ vua Dương Sinh CRM ────────────────────────

const paginationParams = [
  {
    name: "page",
    in: "query" as const,
    schema: { type: "integer" as const, default: 1, minimum: 1 },
    description: "Page number",
  },
  {
    name: "limit",
    in: "query" as const,
    schema: { type: "integer" as const, default: 20, minimum: 1, maximum: 100 },
    description: "Items per page",
  },
];

const searchParam = {
  name: "q",
  in: "query" as const,
  schema: { type: "string" as const },
  description: "Search keyword (tìm kiếm)",
};
const cursorParam = {
  name: "cursor",
  in: "query" as const,
  schema: { type: "string" as const },
  description: "Cursor for next page (cursor-based pagination)",
};

const errorResponses = {
  "400": {
    description: "Bad Request — validation failed",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  },
  "401": {
    description: "Unauthorized — not authenticated",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  },
  "403": {
    description: "Forbidden — insufficient permissions",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  },
  "404": {
    description: "Not Found",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  },
  "500": {
    description: "Internal Server Error",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorResponse" },
      },
    },
  },
};

export const openApiSpec = {
  openapi: "3.0.0",
  info: {
    title: "Cờ vua Dương Sinh CRM API",
    version: "1.0.0",
    description:
      "API documentation for Cờ vua Dương Sinh CRM — Defense-Grade Customer Relationship Management by Cờ vua Dương Sinh.\n\nFeatures: Contact & Company management, Deal pipeline, Quotes & Orders, Support tickets with SLA, Email campaigns, Customer portal, Webhooks, Analytics, Multi-Currency, Document Management, and Compliance.",
    contact: { name: "Cờ vua Dương Sinh" },
  },
  servers: [{ url: "/api", description: "CRM API" }],
  tags: [
    { name: "Auth", description: "Authentication & registration" },
    { name: "Contacts", description: "Contact management (Quản lý liên hệ)" },
    { name: "Companies", description: "Company management (Quản lý công ty)" },
    { name: "Deals", description: "Deal pipeline management (Quản lý cơ hội)" },
    { name: "Quotes", description: "Quote creation & management (Báo giá)" },
    { name: "Orders", description: "Sales order management (Đơn hàng)" },
    { name: "Activities", description: "Activity tracking (Hoạt động)" },
    {
      name: "Tickets",
      description: "Support ticket management with SLA (Hỗ trợ)",
    },
    {
      name: "Campaigns",
      description: "Email campaign management (Chiến dịch)",
    },
    { name: "Audiences", description: "Audience segmentation (Đối tượng)" },
    {
      name: "Email Templates",
      description: "Email template management (Mẫu email)",
    },
    { name: "Notifications", description: "In-app notifications (Thông báo)" },
    { name: "Webhooks", description: "Webhook management — ADMIN only" },
    { name: "Analytics", description: "Dashboard & reporting (Phân tích)" },
    { name: "Settings", description: "System settings (Cài đặt)" },
    { name: "Users", description: "User management" },
    { name: "Products", description: "Product catalog (Sản phẩm)" },
    { name: "Search", description: "Global search" },
    {
      name: "Tracking",
      description: "Email tracking (open/click) — public, no auth",
    },
    {
      name: "Portal",
      description: "Customer portal — PortalSession auth (Cổng khách hàng)",
    },
    { name: "Internal", description: "Internal integration endpoints" },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http" as const,
        scheme: "bearer",
        description: "Supabase JWT token",
      },
      PortalSession: {
        type: "apiKey" as const,
        in: "cookie" as const,
        name: "portal_session",
        description: "Portal session cookie (magic link auth)",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object" as const,
        properties: {
          error: { type: "string" as const },
          code: { type: "string" as const },
          message: { type: "string" as const },
          details: { type: "object" as const },
        },
      },
      PaginatedResponse: {
        type: "object" as const,
        properties: {
          data: { type: "array" as const, items: {} },
          total: { type: "integer" as const },
          page: { type: "integer" as const },
          limit: { type: "integer" as const },
          totalPages: { type: "integer" as const },
        },
      },
      Contact: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const, format: "cuid" },
          firstName: { type: "string" as const },
          lastName: { type: "string" as const },
          email: { type: "string" as const, format: "email" },
          phone: { type: "string" as const },
          mobile: { type: "string" as const },
          status: {
            type: "string" as const,
            enum: [
              "LEAD",
              "CONTACTED",
              "QUALIFIED",
              "OPPORTUNITY",
              "CUSTOMER",
              "CHURNED",
            ],
          },
          source: {
            type: "string" as const,
            enum: [
              "WEBSITE",
              "REFERRAL",
              "COLD_CALL",
              "EMAIL",
              "SOCIAL",
              "EVENT",
              "PARTNER",
              "OTHER",
            ],
          },
          score: { type: "integer" as const },
          jobTitle: { type: "string" as const },
          department: { type: "string" as const },
          companyId: { type: "string" as const },
          ownerId: { type: "string" as const },
          notes: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
          updatedAt: { type: "string" as const, format: "date-time" },
        },
      },
      CreateContact: {
        type: "object" as const,
        required: ["firstName", "lastName"],
        properties: {
          firstName: { type: "string" as const },
          lastName: { type: "string" as const },
          email: { type: "string" as const, format: "email" },
          phone: { type: "string" as const },
          mobile: { type: "string" as const },
          status: {
            type: "string" as const,
            enum: [
              "LEAD",
              "CONTACTED",
              "QUALIFIED",
              "OPPORTUNITY",
              "CUSTOMER",
              "CHURNED",
            ],
            default: "LEAD",
          },
          source: { type: "string" as const },
          jobTitle: { type: "string" as const },
          department: { type: "string" as const },
          companyId: { type: "string" as const },
          notes: { type: "string" as const },
        },
      },
      Company: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          domain: { type: "string" as const },
          industry: { type: "string" as const },
          size: { type: "string" as const },
          phone: { type: "string" as const },
          email: { type: "string" as const },
          website: { type: "string" as const },
          address: { type: "string" as const },
          city: { type: "string" as const },
          province: { type: "string" as const },
          country: { type: "string" as const },
          taxCode: { type: "string" as const },
          notes: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Deal: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          title: { type: "string" as const },
          value: { type: "number" as const },
          status: { type: "string" as const, enum: ["OPEN", "WON", "LOST"] },
          stageId: { type: "string" as const },
          contactId: { type: "string" as const },
          companyId: { type: "string" as const },
          expectedCloseDate: { type: "string" as const, format: "date" },
          probability: { type: "integer" as const, minimum: 0, maximum: 100 },
          notes: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Quote: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          quoteNumber: { type: "string" as const, example: "QUO-2025-0001" },
          status: {
            type: "string" as const,
            enum: [
              "DRAFT",
              "SENT",
              "VIEWED",
              "ACCEPTED",
              "REJECTED",
              "EXPIRED",
            ],
          },
          total: { type: "number" as const },
          subTotal: { type: "number" as const },
          taxPercent: { type: "number" as const },
          taxAmount: { type: "number" as const },
          discount: { type: "number" as const },
          validUntil: { type: "string" as const, format: "date" },
          notes: { type: "string" as const },
          items: {
            type: "array" as const,
            items: { $ref: "#/components/schemas/QuoteItem" },
          },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      QuoteItem: {
        type: "object" as const,
        properties: {
          productId: { type: "string" as const },
          description: { type: "string" as const },
          quantity: { type: "number" as const, minimum: 1 },
          unitPrice: { type: "number" as const, minimum: 0 },
          total: { type: "number" as const },
        },
      },
      SalesOrder: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          orderNumber: { type: "string" as const, example: "ORD-2025-0001" },
          status: {
            type: "string" as const,
            enum: [
              "PENDING",
              "CONFIRMED",
              "IN_PRODUCTION",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "REFUNDED",
            ],
          },
          total: { type: "number" as const },
          shippingAddress: { type: "string" as const },
          trackingNumber: { type: "string" as const },
          shippingProvider: { type: "string" as const },
          notes: { type: "string" as const },
          confirmedAt: { type: "string" as const, format: "date-time" },
          shippedAt: { type: "string" as const, format: "date-time" },
          deliveredAt: { type: "string" as const, format: "date-time" },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      OrderTransition: {
        type: "object" as const,
        required: ["toStatus"],
        properties: {
          toStatus: {
            type: "string" as const,
            enum: [
              "PENDING",
              "CONFIRMED",
              "IN_PRODUCTION",
              "SHIPPED",
              "DELIVERED",
              "CANCELLED",
              "REFUNDED",
            ],
          },
          note: { type: "string" as const, maxLength: 1000 },
          cancellationReason: {
            type: "string" as const,
            description: "Required when toStatus=CANCELLED",
          },
          refundAmount: {
            type: "number" as const,
            minimum: 0,
            description: "Required when toStatus=REFUNDED",
          },
          trackingNumber: { type: "string" as const },
          shippingProvider: { type: "string" as const },
        },
      },
      SupportTicket: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          ticketNumber: { type: "string" as const, example: "TK-2025-0001" },
          subject: { type: "string" as const },
          status: {
            type: "string" as const,
            enum: [
              "OPEN",
              "IN_PROGRESS",
              "WAITING_CUSTOMER",
              "RESOLVED",
              "CLOSED",
            ],
          },
          priority: {
            type: "string" as const,
            enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
          },
          assigneeId: { type: "string" as const },
          slaStatus: {
            type: "string" as const,
            enum: ["on_track", "at_risk", "breached", "met"],
          },
          sla: {
            type: "object" as const,
            properties: {
              firstResponse: { $ref: "#/components/schemas/SlaTimer" },
              resolution: { $ref: "#/components/schemas/SlaTimer" },
            },
          },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      SlaTimer: {
        type: "object" as const,
        properties: {
          target: { type: "string" as const, format: "date-time" },
          actual: {
            type: "string" as const,
            format: "date-time",
            nullable: true,
          },
          remaining: {
            type: "integer" as const,
            description: "Milliseconds remaining (negative = breached)",
          },
          status: {
            type: "string" as const,
            enum: ["on_track", "at_risk", "breached", "met"],
          },
        },
      },
      TicketMessage: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          content: { type: "string" as const },
          isInternal: { type: "boolean" as const },
          userId: { type: "string" as const },
          portalUserId: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Campaign: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          subject: { type: "string" as const },
          status: {
            type: "string" as const,
            enum: ["DRAFT", "SCHEDULED", "SENDING", "SENT", "FAILED"],
          },
          audienceId: { type: "string" as const },
          scheduledAt: { type: "string" as const, format: "date-time" },
          sentAt: { type: "string" as const, format: "date-time" },
          stats: {
            type: "object" as const,
            properties: {
              sent: { type: "integer" as const },
              opened: { type: "integer" as const },
              clicked: { type: "integer" as const },
              bounced: { type: "integer" as const },
            },
          },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Notification: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          type: { type: "string" as const },
          title: { type: "string" as const },
          message: { type: "string" as const },
          read: { type: "boolean" as const },
          link: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Webhook: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          url: { type: "string" as const, format: "url" },
          events: {
            type: "array" as const,
            items: { type: "string" as const },
          },
          active: { type: "boolean" as const },
          secret: {
            type: "string" as const,
            description: "Only returned at creation time",
          },
          successRate: { type: "integer" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Activity: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          type: {
            type: "string" as const,
            enum: ["CALL", "EMAIL", "MEETING", "TASK", "NOTE", "FOLLOW_UP"],
          },
          subject: { type: "string" as const },
          description: { type: "string" as const },
          completed: { type: "boolean" as const },
          dueDate: { type: "string" as const, format: "date-time" },
          contactId: { type: "string" as const },
          dealId: { type: "string" as const },
          createdAt: { type: "string" as const, format: "date-time" },
        },
      },
      Product: {
        type: "object" as const,
        properties: {
          id: { type: "string" as const },
          name: { type: "string" as const },
          sku: { type: "string" as const },
          price: { type: "number" as const },
          category: { type: "string" as const },
          active: { type: "boolean" as const },
        },
      },
    },
  },
  security: [{ BearerAuth: [] }],
  paths: {
    // ── AUTH ──────────────────────────────────────────────────────
    "/auth/me": {
      get: {
        operationId: "getMe",
        tags: ["Auth"],
        summary: "Get current user profile",
        responses: {
          "200": {
            description: "Current user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    email: { type: "string" },
                    name: { type: "string" },
                    role: { type: "string" },
                  },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    "/auth/register": {
      post: {
        operationId: "register",
        tags: ["Auth"],
        summary: "Register/sync Supabase user to database",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  email: { type: "string" },
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "User registered" },
          ...errorResponses,
        },
      },
    },

    // ── CONTACTS ─────────────────────────────────────────────────
    "/contacts": {
      get: {
        operationId: "listContacts",
        tags: ["Contacts"],
        summary: "List contacts with search, filter, pagination",
        description:
          "MEMBER/VIEWER: sees own contacts only. MANAGER+: sees all.",
        parameters: [
          ...paginationParams,
          searchParam,
          cursorParam,
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "companyId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated contacts",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginatedResponse" },
              },
            },
          },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createContact",
        tags: ["Contacts"],
        summary: "Create a new contact",
        description: "Requires MEMBER+ role. VIEWER gets 403.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateContact" },
            },
          },
        },
        responses: {
          "201": {
            description: "Contact created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Contact" },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    "/contacts/{id}": {
      get: {
        operationId: "getContact",
        tags: ["Contacts"],
        summary: "Get contact detail with activities and deals",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Contact detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Contact" },
              },
            },
          },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateContact",
        tags: ["Contacts"],
        summary: "Update contact fields",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateContact" },
            },
          },
        },
        responses: {
          "200": { description: "Updated contact" },
          ...errorResponses,
        },
      },
      delete: {
        operationId: "deleteContact",
        tags: ["Contacts"],
        summary: "Delete contact",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Contact deleted" },
          ...errorResponses,
        },
      },
    },
    "/contacts/export": {
      get: {
        operationId: "exportContacts",
        tags: ["Contacts"],
        summary: "Export contacts as CSV",
        responses: {
          "200": { description: "CSV file", content: { "text/csv": {} } },
          ...errorResponses,
        },
      },
    },
    "/contacts/import": {
      post: {
        operationId: "importContacts",
        tags: ["Contacts"],
        summary: "Import contacts from CSV",
        description:
          "Supports Vietnamese and English column headers. Duplicate detection by email.",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Import result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    created: { type: "integer" },
                    updated: { type: "integer" },
                    skipped: { type: "integer" },
                    failed: { type: "integer" },
                    errors: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },

    // ── COMPANIES ────────────────────────────────────────────────
    "/companies": {
      get: {
        operationId: "listCompanies",
        tags: ["Companies"],
        summary: "List companies with search and pagination",
        parameters: [...paginationParams, searchParam, cursorParam],
        responses: {
          "200": {
            description: "Paginated companies",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PaginatedResponse" },
              },
            },
          },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createCompany",
        tags: ["Companies"],
        summary: "Create a new company",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  domain: { type: "string" },
                  industry: { type: "string" },
                  size: { type: "string" },
                  phone: { type: "string" },
                  email: { type: "string" },
                  website: { type: "string" },
                  address: { type: "string" },
                  taxCode: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Company created" },
          ...errorResponses,
        },
      },
    },
    "/companies/{id}": {
      get: {
        operationId: "getCompany",
        tags: ["Companies"],
        summary: "Get company detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Company detail" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateCompany",
        tags: ["Companies"],
        summary: "Update company",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteCompany",
        tags: ["Companies"],
        summary: "Delete company",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/companies/export": {
      get: {
        operationId: "exportCompanies",
        tags: ["Companies"],
        summary: "Export companies as CSV",
        responses: { "200": { description: "CSV file" }, ...errorResponses },
      },
    },
    "/companies/import": {
      post: {
        operationId: "importCompanies",
        tags: ["Companies"],
        summary: "Import companies from CSV",
        requestBody: {
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: { file: { type: "string", format: "binary" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Import result" },
          ...errorResponses,
        },
      },
    },

    // ── DEALS ────────────────────────────────────────────────────
    "/deals": {
      get: {
        operationId: "listDeals",
        tags: ["Deals"],
        summary: "List deals with filters",
        parameters: [
          ...paginationParams,
          searchParam,
          { name: "stageId", in: "query", schema: { type: "string" } },
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["OPEN", "WON", "LOST"] },
          },
        ],
        responses: {
          "200": { description: "Paginated deals" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createDeal",
        tags: ["Deals"],
        summary: "Create a new deal",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title"],
                properties: {
                  title: { type: "string" },
                  value: { type: "number" },
                  stageId: { type: "string" },
                  contactId: { type: "string" },
                  companyId: { type: "string" },
                  expectedCloseDate: { type: "string", format: "date" },
                  probability: { type: "integer" },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Deal created" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "bulkMoveDeals",
        tags: ["Deals"],
        summary: "Bulk stage move (Kanban)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  moves: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "string" },
                        stageId: { type: "string" },
                        order: { type: "integer" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Moves applied" },
          ...errorResponses,
        },
      },
    },
    "/deals/{id}": {
      get: {
        operationId: "getDeal",
        tags: ["Deals"],
        summary: "Get deal detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deal detail" }, ...errorResponses },
      },
      patch: {
        operationId: "updateDeal",
        tags: ["Deals"],
        summary: "Update deal (stage change emits webhook)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Updated deal" },
          ...errorResponses,
        },
      },
      delete: {
        operationId: "deleteDeal",
        tags: ["Deals"],
        summary: "Delete deal",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },

    // ── QUOTES ───────────────────────────────────────────────────
    "/quotes": {
      get: {
        operationId: "listQuotes",
        tags: ["Quotes"],
        summary: "List quotes (Danh sách báo giá)",
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Paginated quotes" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createQuote",
        tags: ["Quotes"],
        summary: "Create quote with auto-numbering (QUO-YYYY-NNNN)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  contactId: { type: "string" },
                  companyId: { type: "string" },
                  dealId: { type: "string" },
                  validUntil: { type: "string", format: "date" },
                  notes: { type: "string" },
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/QuoteItem" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Quote created" },
          ...errorResponses,
        },
      },
    },
    "/quotes/{id}": {
      get: {
        operationId: "getQuote",
        tags: ["Quotes"],
        summary: "Get quote detail with items",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Quote detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Quote" },
              },
            },
          },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateQuote",
        tags: ["Quotes"],
        summary: "Update quote",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteQuote",
        tags: ["Quotes"],
        summary: "Delete quote",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/quotes/{id}/pdf": {
      get: {
        operationId: "getQuotePdf",
        tags: ["Quotes"],
        summary: "Download quote PDF",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "PDF file",
            content: { "application/pdf": {} },
          },
          ...errorResponses,
        },
      },
    },
    "/quotes/{id}/send": {
      post: {
        operationId: "sendQuote",
        tags: ["Quotes"],
        summary: "Send quote email with PDF attachment",
        description: "Marks quote status as SENT. Emits QUOTE_SENT event.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  to: { type: "string", format: "email" },
                  subject: { type: "string" },
                  body: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Quote sent" }, ...errorResponses },
      },
    },
    "/quotes/check-expiry": {
      post: {
        operationId: "checkQuoteExpiry",
        tags: ["Quotes"],
        summary: "Check and auto-expire overdue quotes",
        description:
          "Finds quotes past validUntil, marks as EXPIRED, sends reminders.",
        responses: {
          "200": { description: "Expiry check result" },
          ...errorResponses,
        },
      },
    },

    // ── ORDERS ───────────────────────────────────────────────────
    "/orders": {
      get: {
        operationId: "listOrders",
        tags: ["Orders"],
        summary: "List orders (Danh sách đơn hàng)",
        parameters: [
          ...paginationParams,
          { name: "status", in: "query", schema: { type: "string" } },
          cursorParam,
        ],
        responses: {
          "200": { description: "Paginated orders" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createOrder",
        tags: ["Orders"],
        summary: "Create order with auto-numbering (ORD-YYYY-NNNN)",
        description:
          "Can be created from a quote (quoteId). Emits ORDER_CREATED event.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  companyId: { type: "string" },
                  dealId: { type: "string" },
                  quoteId: { type: "string" },
                  shippingAddress: { type: "string" },
                  notes: { type: "string" },
                  items: {
                    type: "array",
                    items: { $ref: "#/components/schemas/QuoteItem" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Order created" },
          ...errorResponses,
        },
      },
    },
    "/orders/{id}": {
      get: {
        operationId: "getOrder",
        tags: ["Orders"],
        summary: "Get order detail with items and status history",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Order detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SalesOrder" },
              },
            },
          },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateOrder",
        tags: ["Orders"],
        summary: "Update order fields",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteOrder",
        tags: ["Orders"],
        summary: "Delete order",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/orders/{id}/pdf": {
      get: {
        operationId: "getOrderPdf",
        tags: ["Orders"],
        summary: "Download order PDF",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "PDF file",
            content: { "application/pdf": {} },
          },
          ...errorResponses,
        },
      },
    },
    "/orders/{id}/transition": {
      post: {
        operationId: "transitionOrder",
        tags: ["Orders"],
        summary: "Transition order status via state machine",
        description:
          "Valid transitions: PENDING→CONFIRMED→IN_PRODUCTION→SHIPPED→DELIVERED→REFUNDED. Any non-terminal→CANCELLED. CANCELLED requires cancellationReason. REFUNDED requires refundAmount ≤ total.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/OrderTransition" },
            },
          },
        },
        responses: {
          "200": {
            description: "Transition successful",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SalesOrder" },
              },
            },
          },
          ...errorResponses,
        },
      },
    },

    // ── ACTIVITIES ───────────────────────────────────────────────
    "/activities": {
      get: {
        operationId: "listActivities",
        tags: ["Activities"],
        summary: "List activities with filters",
        parameters: [
          ...paginationParams,
          { name: "type", in: "query", schema: { type: "string" } },
          { name: "contactId", in: "query", schema: { type: "string" } },
          { name: "dealId", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Paginated activities" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createActivity",
        tags: ["Activities"],
        summary: "Create activity (call, email, meeting, task, note)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "subject"],
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "CALL",
                      "EMAIL",
                      "MEETING",
                      "TASK",
                      "NOTE",
                      "FOLLOW_UP",
                    ],
                  },
                  subject: { type: "string" },
                  description: { type: "string" },
                  dueDate: { type: "string", format: "date-time" },
                  contactId: { type: "string" },
                  dealId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, ...errorResponses },
      },
    },
    "/activities/{id}": {
      patch: {
        operationId: "updateActivity",
        tags: ["Activities"],
        summary: "Update activity (mark complete, edit)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteActivity",
        tags: ["Activities"],
        summary: "Delete activity",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },

    // ── TICKETS ──────────────────────────────────────────────────
    "/tickets": {
      get: {
        operationId: "listTickets",
        tags: ["Tickets"],
        summary: "List tickets with SLA status",
        description:
          "MEMBER: sees assigned tickets only. MANAGER+: sees all. Includes SLA status (on_track, at_risk, breached).",
        parameters: [
          ...paginationParams,
          searchParam,
          {
            name: "status",
            in: "query",
            schema: {
              type: "string",
              enum: [
                "OPEN",
                "IN_PROGRESS",
                "WAITING_CUSTOMER",
                "RESOLVED",
                "CLOSED",
              ],
            },
          },
          {
            name: "priority",
            in: "query",
            schema: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
            },
          },
          { name: "assigneeId", in: "query", schema: { type: "string" } },
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date" },
          },
        ],
        responses: {
          "200": { description: "Paginated tickets with SLA" },
          ...errorResponses,
        },
      },
    },
    "/tickets/{id}": {
      get: {
        operationId: "getTicket",
        tags: ["Tickets"],
        summary: "Get ticket detail with messages and SLA",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Ticket detail",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/SupportTicket" },
              },
            },
          },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateTicket",
        tags: ["Tickets"],
        summary: "Update ticket status, priority, assignee",
        description:
          "Status transitions: OPEN→IN_PROGRESS/WAITING_CUSTOMER/RESOLVED/CLOSED, IN_PROGRESS→WAITING_CUSTOMER/RESOLVED/CLOSED, RESOLVED→OPEN/CLOSED, CLOSED→OPEN.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: {
                    type: "string",
                    enum: [
                      "OPEN",
                      "IN_PROGRESS",
                      "WAITING_CUSTOMER",
                      "RESOLVED",
                      "CLOSED",
                    ],
                  },
                  priority: {
                    type: "string",
                    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                  },
                  assigneeId: { type: "string", nullable: true },
                  category: { type: "string", maxLength: 100 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated ticket" },
          ...errorResponses,
        },
      },
    },
    "/tickets/{id}/messages": {
      post: {
        operationId: "createTicketMessage",
        tags: ["Tickets"],
        summary: "Post staff reply or internal note",
        description:
          "Public replies (isInternal=false) auto-set firstResponseAt on first reply and change status to WAITING_CUSTOMER.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", minLength: 1, maxLength: 5000 },
                  isInternal: { type: "boolean", default: false },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Message created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TicketMessage" },
              },
            },
          },
          ...errorResponses,
        },
      },
    },

    // ── CAMPAIGNS ────────────────────────────────────────────────
    "/campaigns": {
      get: {
        operationId: "listCampaigns",
        tags: ["Campaigns"],
        summary: "List campaigns (MANAGER+)",
        parameters: [...paginationParams],
        responses: {
          "200": { description: "Paginated campaigns" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createCampaign",
        tags: ["Campaigns"],
        summary: "Create campaign",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "subject"],
                properties: {
                  name: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                  audienceId: { type: "string" },
                  scheduledAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, ...errorResponses },
      },
    },
    "/campaigns/{id}": {
      get: {
        operationId: "getCampaign",
        tags: ["Campaigns"],
        summary: "Get campaign detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Campaign detail" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateCampaign",
        tags: ["Campaigns"],
        summary: "Update campaign",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteCampaign",
        tags: ["Campaigns"],
        summary: "Delete campaign",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/campaigns/{id}/stats": {
      get: {
        operationId: "getCampaignStats",
        tags: ["Campaigns"],
        summary: "Campaign performance stats",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Stats (sent, opened, clicked, bounced)" },
          ...errorResponses,
        },
      },
    },
    "/campaigns/{id}/send": {
      post: {
        operationId: "sendCampaign",
        tags: ["Campaigns"],
        summary: "Send campaign to audience",
        description:
          "Sends emails with A/B variant support and tracking pixels.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Campaign sent" },
          ...errorResponses,
        },
      },
    },
    "/campaigns/test-send": {
      post: {
        operationId: "testSendCampaign",
        tags: ["Campaigns"],
        summary: "Send test email (rate limited)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  subject: { type: "string" },
                  body: { type: "string" },
                  to: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Test email sent" },
          ...errorResponses,
        },
      },
    },
    "/campaigns/process-scheduled": {
      post: {
        operationId: "processScheduledCampaigns",
        tags: ["Campaigns"],
        summary: "Process due scheduled campaigns (cron)",
        responses: {
          "200": { description: "Processed result" },
          ...errorResponses,
        },
      },
    },

    // ── AUDIENCES ────────────────────────────────────────────────
    "/audiences": {
      get: {
        operationId: "listAudiences",
        tags: ["Audiences"],
        summary: "List audiences",
        responses: {
          "200": { description: "Audience list" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createAudience",
        tags: ["Audiences"],
        summary: "Create audience with rules",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  type: { type: "string", enum: ["STATIC", "DYNAMIC"] },
                  rules: { type: "object" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, ...errorResponses },
      },
    },
    "/audiences/{id}": {
      get: {
        operationId: "getAudience",
        tags: ["Audiences"],
        summary: "Get audience detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Audience detail" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateAudience",
        tags: ["Audiences"],
        summary: "Update audience",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteAudience",
        tags: ["Audiences"],
        summary: "Delete audience",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/audiences/preview": {
      post: {
        operationId: "previewAudience",
        tags: ["Audiences"],
        summary: "Preview audience count from rules",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { rules: { type: "object" } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Preview count",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { count: { type: "integer" } },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },

    // ── EMAIL TEMPLATES ──────────────────────────────────────────
    "/email-templates": {
      get: {
        operationId: "listEmailTemplates",
        tags: ["Email Templates"],
        summary: "List email templates (MANAGER+)",
        responses: {
          "200": { description: "Template list" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createEmailTemplate",
        tags: ["Email Templates"],
        summary: "Create email template",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "subject", "body"],
                properties: {
                  name: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                  category: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, ...errorResponses },
      },
    },
    "/email-templates/{id}": {
      get: {
        operationId: "getEmailTemplate",
        tags: ["Email Templates"],
        summary: "Get template detail",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Template detail" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateEmailTemplate",
        tags: ["Email Templates"],
        summary: "Update template",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteEmailTemplate",
        tags: ["Email Templates"],
        summary: "Delete template",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/email/send": {
      post: {
        operationId: "sendEmail",
        tags: ["Email Templates"],
        summary: "Send email (internal, rate limited)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  to: { type: "string" },
                  subject: { type: "string" },
                  body: { type: "string" },
                  templateId: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Sent" }, ...errorResponses },
      },
    },

    // ── NOTIFICATIONS ────────────────────────────────────────────
    "/notifications": {
      get: {
        operationId: "listNotifications",
        tags: ["Notifications"],
        summary: "List notifications with unread count",
        parameters: [
          ...paginationParams,
          { name: "unread", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": {
            description: "Notifications with unread count",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Notification" },
                    },
                    unreadCount: { type: "integer" },
                  },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    "/notifications/{id}/read": {
      patch: {
        operationId: "markNotificationRead",
        tags: ["Notifications"],
        summary: "Mark notification as read",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Marked as read" },
          ...errorResponses,
        },
      },
    },
    "/notifications/mark-all-read": {
      post: {
        operationId: "markAllNotificationsRead",
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        responses: {
          "200": { description: "All marked as read" },
          ...errorResponses,
        },
      },
    },
    "/notifications/preferences": {
      get: {
        operationId: "getNotificationPreferences",
        tags: ["Notifications"],
        summary: "Get notification preferences per event type",
        responses: {
          "200": {
            description: "Preferences array with inApp and email toggles",
          },
          ...errorResponses,
        },
      },
      put: {
        operationId: "updateNotificationPreferences",
        tags: ["Notifications"],
        summary: "Update notification preferences",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  preferences: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        eventType: { type: "string" },
                        inApp: { type: "boolean" },
                        email: { type: "boolean" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Updated preferences" },
          ...errorResponses,
        },
      },
    },
    "/notifications/unsubscribe": {
      get: {
        operationId: "unsubscribe",
        tags: ["Notifications"],
        summary: "Unsubscribe from email notifications (public)",
        security: [],
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Unsubscribed" } },
      },
    },

    // ── WEBHOOKS ─────────────────────────────────────────────────
    "/webhooks": {
      get: {
        operationId: "listWebhooks",
        tags: ["Webhooks"],
        summary: "List all webhooks with delivery stats (ADMIN only)",
        description:
          "Returns webhooks with success rate and recent delivery log.",
        responses: {
          "200": {
            description: "Webhook list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Webhook" },
                },
              },
            },
          },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createWebhook",
        tags: ["Webhooks"],
        summary: "Create webhook with auto-generated HMAC secret (ADMIN only)",
        description:
          "Secret (whsec_...) is only returned at creation time. Store it securely.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "url", "events"],
                properties: {
                  name: { type: "string", maxLength: 100 },
                  url: { type: "string", format: "url" },
                  events: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Webhook created with secret",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Webhook" },
              },
            },
          },
          ...errorResponses,
        },
      },
    },
    "/webhooks/{id}": {
      get: {
        operationId: "getWebhook",
        tags: ["Webhooks"],
        summary: "Get webhook detail with recent delivery logs (ADMIN)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Webhook detail" },
          ...errorResponses,
        },
      },
      patch: {
        operationId: "updateWebhook",
        tags: ["Webhooks"],
        summary: "Update webhook (toggle active, change events)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  events: { type: "array", items: { type: "string" } },
                  active: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
      delete: {
        operationId: "deleteWebhook",
        tags: ["Webhooks"],
        summary: "Delete webhook (ADMIN)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Deleted" }, ...errorResponses },
      },
    },
    "/webhooks/{id}/test": {
      post: {
        operationId: "testWebhook",
        tags: ["Webhooks"],
        summary: "Send test delivery to webhook (ADMIN)",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Test delivery result" },
          ...errorResponses,
        },
      },
    },

    // ── ANALYTICS & REPORTS ──────────────────────────────────────
    "/analytics/dashboard": {
      get: {
        operationId: "getDashboard",
        tags: ["Analytics"],
        summary: "Dashboard KPIs with period comparison",
        description:
          "Returns funnel, deals over time, quotes, contacts, campaigns, activities. Supports date range and compare mode.",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          { name: "compare", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Dashboard data" },
          ...errorResponses,
        },
      },
    },
    "/reports": {
      get: {
        operationId: "getReports",
        tags: ["Analytics"],
        summary: "Get report data (dashboard, funnel, revenue)",
        parameters: [
          {
            name: "type",
            in: "query",
            schema: {
              type: "string",
              enum: ["dashboard", "funnel", "revenue"],
            },
          },
        ],
        responses: { "200": { description: "Report data" }, ...errorResponses },
      },
    },
    "/reports/export": {
      get: {
        operationId: "exportReport",
        tags: ["Analytics"],
        summary: "Export sales report as CSV",
        parameters: [
          {
            name: "from",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          {
            name: "to",
            in: "query",
            schema: { type: "string", format: "date" },
          },
          { name: "type", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "CSV file" }, ...errorResponses },
      },
    },

    // ── SETTINGS ─────────────────────────────────────────────────
    "/settings": {
      get: {
        operationId: "getAllSettings",
        tags: ["Settings"],
        summary: "Get all settings merged with defaults",
        responses: {
          "200": {
            description:
              "All settings (company, pipeline, notifications, email, order)",
          },
          ...errorResponses,
        },
      },
    },
    "/settings/{key}": {
      get: {
        operationId: "getSetting",
        tags: ["Settings"],
        summary: "Get single setting by key",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["company", "pipeline", "notifications", "email", "order"],
            },
          },
        ],
        responses: {
          "200": { description: "Setting value" },
          ...errorResponses,
        },
      },
      put: {
        operationId: "updateSetting",
        tags: ["Settings"],
        summary: "Update setting by key (ADMIN only)",
        parameters: [
          {
            name: "key",
            in: "path",
            required: true,
            schema: {
              type: "string",
              enum: ["company", "pipeline", "notifications", "email", "order"],
            },
          },
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Updated setting" },
          ...errorResponses,
        },
      },
    },
    "/settings/sla": {
      get: {
        operationId: "getSlaConfig",
        tags: ["Settings"],
        summary: "Get SLA configs and ticket assignment strategy",
        responses: {
          "200": { description: "SLA configs by priority" },
          ...errorResponses,
        },
      },
      put: {
        operationId: "updateSlaConfig",
        tags: ["Settings"],
        summary: "Update SLA configs",
        requestBody: {
          content: { "application/json": { schema: { type: "object" } } },
        },
        responses: {
          "200": { description: "Updated SLA config" },
          ...errorResponses,
        },
      },
    },

    // ── USERS & PRODUCTS ────────────────────────────────────────
    "/users": {
      get: {
        operationId: "listUsers",
        tags: ["Users"],
        summary: "List staff members (for dropdowns)",
        responses: { "200": { description: "User list" }, ...errorResponses },
      },
    },
    "/products": {
      get: {
        operationId: "listProducts",
        tags: ["Products"],
        summary: "List products with filters",
        parameters: [
          searchParam,
          { name: "category", in: "query", schema: { type: "string" } },
          { name: "active", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": { description: "Product list" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "createProduct",
        tags: ["Products"],
        summary: "Create product",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "price"],
                properties: {
                  name: { type: "string" },
                  sku: { type: "string" },
                  price: { type: "number" },
                  category: { type: "string" },
                  active: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Created" }, ...errorResponses },
      },
    },

    // ── PIPELINE & SEARCH ───────────────────────────────────────
    "/pipeline": {
      get: {
        operationId: "getPipeline",
        tags: ["Deals"],
        summary: "Get default pipeline with stages and deals (Kanban board)",
        responses: {
          "200": { description: "Pipeline with stages" },
          ...errorResponses,
        },
      },
    },
    "/search": {
      get: {
        operationId: "globalSearch",
        tags: ["Search"],
        summary: "Global search across contacts, companies, deals, quotes",
        description: "Minimum 2 characters. Returns categorized results.",
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            schema: { type: "string", minLength: 2 },
          },
        ],
        responses: {
          "200": { description: "Search results" },
          ...errorResponses,
        },
      },
    },

    // ── TRACKING (PUBLIC) ───────────────────────────────────────
    "/track/open": {
      get: {
        operationId: "trackOpen",
        tags: ["Tracking"],
        summary: "Email open tracking pixel (returns 1x1 GIF)",
        security: [],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "1x1 transparent GIF",
            content: { "image/gif": {} },
          },
        },
      },
    },
    "/track/click": {
      get: {
        operationId: "trackClick",
        tags: ["Tracking"],
        summary: "Email click tracking redirect",
        security: [],
        parameters: [
          {
            name: "id",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "url",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "302": { description: "Redirect to target URL" } },
      },
    },
    "/unsubscribe": {
      get: {
        operationId: "unsubscribeEmail",
        tags: ["Tracking"],
        summary: "Public unsubscribe endpoint",
        security: [],
        parameters: [
          {
            name: "email",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
          {
            name: "token",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Unsubscribed" } },
      },
    },

    // ── PORTAL ───────────────────────────────────────────────────
    "/portal/auth": {
      post: {
        operationId: "portalLogin",
        tags: ["Portal"],
        summary: "Request magic link (email-based auth)",
        security: [],
        description: "Sends magic link to email. Rate limited.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string", format: "email" } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Magic link sent" },
          ...errorResponses,
        },
      },
    },
    "/portal/auth/verify": {
      get: {
        operationId: "portalVerify",
        tags: ["Portal"],
        summary: "Verify magic token and create session",
        security: [],
        parameters: [
          {
            name: "token",
            in: "query",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Session created, cookie set" },
          ...errorResponses,
        },
      },
    },
    "/portal/auth/logout": {
      post: {
        operationId: "portalLogout",
        tags: ["Portal"],
        summary: "Invalidate portal session",
        security: [{ PortalSession: [] }],
        responses: { "200": { description: "Logged out" } },
      },
    },
    "/portal/me": {
      get: {
        operationId: "portalGetMe",
        tags: ["Portal"],
        summary: "Get portal user profile",
        security: [{ PortalSession: [] }],
        responses: {
          "200": { description: "Portal user profile" },
          ...errorResponses,
        },
      },
    },
    "/portal/profile": {
      put: {
        operationId: "portalUpdateProfile",
        tags: ["Portal"],
        summary: "Update portal user profile",
        security: [{ PortalSession: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  firstName: { type: "string" },
                  lastName: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated" }, ...errorResponses },
      },
    },
    "/portal/dashboard": {
      get: {
        operationId: "portalDashboard",
        tags: ["Portal"],
        summary: "Portal dashboard stats",
        security: [{ PortalSession: [] }],
        responses: {
          "200": {
            description: "Stats (pending quotes, active orders, open tickets)",
          },
          ...errorResponses,
        },
      },
    },
    "/portal/quotes": {
      get: {
        operationId: "portalListQuotes",
        tags: ["Portal"],
        summary: "List customer quotes",
        security: [{ PortalSession: [] }],
        responses: { "200": { description: "Quote list" }, ...errorResponses },
      },
      patch: {
        operationId: "portalRespondQuote",
        tags: ["Portal"],
        summary: "Accept or reject quote",
        security: [{ PortalSession: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action"],
                properties: {
                  action: { type: "string", enum: ["accept", "reject"] },
                  feedback: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Quote response recorded" },
          ...errorResponses,
        },
      },
    },
    "/portal/quotes/{id}/pdf": {
      get: {
        operationId: "portalQuotePdf",
        tags: ["Portal"],
        summary: "Download quote PDF (portal)",
        security: [{ PortalSession: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "PDF" }, ...errorResponses },
      },
    },
    "/portal/quotes/{id}/viewed": {
      post: {
        operationId: "portalMarkQuoteViewed",
        tags: ["Portal"],
        summary: "Mark quote as VIEWED",
        security: [{ PortalSession: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Marked as viewed" } },
      },
    },
    "/portal/orders": {
      get: {
        operationId: "portalListOrders",
        tags: ["Portal"],
        summary: "List customer orders",
        security: [{ PortalSession: [] }],
        responses: { "200": { description: "Order list" }, ...errorResponses },
      },
    },
    "/portal/orders/{id}": {
      get: {
        operationId: "portalGetOrder",
        tags: ["Portal"],
        summary: "Get order detail with status history",
        security: [{ PortalSession: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Order detail" },
          ...errorResponses,
        },
      },
    },
    "/portal/tickets": {
      get: {
        operationId: "portalListTickets",
        tags: ["Portal"],
        summary: "List customer tickets",
        security: [{ PortalSession: [] }],
        responses: { "200": { description: "Ticket list" }, ...errorResponses },
      },
      post: {
        operationId: "portalCreateTicket",
        tags: ["Portal"],
        summary: "Create support ticket",
        security: [{ PortalSession: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["subject", "description"],
                properties: {
                  subject: { type: "string" },
                  description: { type: "string" },
                  priority: {
                    type: "string",
                    enum: ["LOW", "MEDIUM", "HIGH", "URGENT"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Ticket created" },
          ...errorResponses,
        },
      },
    },
    "/portal/tickets/{id}": {
      get: {
        operationId: "portalGetTicket",
        tags: ["Portal"],
        summary: "Get ticket with public messages (internal notes hidden)",
        security: [{ PortalSession: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Ticket with messages" },
          ...errorResponses,
        },
      },
      post: {
        operationId: "portalReplyTicket",
        tags: ["Portal"],
        summary: "Post customer reply (auto-reopens resolved/closed tickets)",
        security: [{ PortalSession: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string", minLength: 1, maxLength: 5000 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Reply posted" },
          ...errorResponses,
        },
      },
    },

    // ── INTERNAL ─────────────────────────────────────────────────
    "/integrations/health": {
      get: {
        operationId: "integrationsHealth",
        tags: ["Internal"],
        summary: "Health check for external module connections",
        responses: { "200": { description: "Health status" } },
      },
    },
    "/internal/pipeline": {
      get: {
        operationId: "internalPipeline",
        tags: ["Internal"],
        summary: "Pipeline revenue forecast for OTB integration",
        responses: { "200": { description: "Pipeline data" } },
      },
    },
    "/internal/customers": {
      get: {
        operationId: "internalCustomers",
        tags: ["Internal"],
        summary: "Customer data for TPM integration",
        responses: {
          "200": { description: "Customer data with contacts and deals" },
        },
      },
    },
  },
} as const;
