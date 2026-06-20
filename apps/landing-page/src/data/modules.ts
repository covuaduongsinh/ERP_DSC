/**
 * VietERP Modules Data
 * ====================
 * 14 Modules across 4 Categories
 */

import {
  Calculator,
  Users,
  Factory,
  ShoppingCart,
  Tag,
  Package,
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Briefcase,
  Truck,
  BookOpen,
  Users2,
  type LucideIcon,
} from "lucide-react";

export interface Module {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  color: string;
  icon: LucideIcon;
  port: number;
  features: string[];
  category: ModuleCategory;
}

export type ModuleCategory =
  | "core"
  | "commerce"
  | "operations"
  | "intelligence";

export interface CategoryInfo {
  id: ModuleCategory;
  name: string;
  fullName: string;
  tagline: string;
  description: string;
  color: string;
}

export const categories: Record<ModuleCategory, CategoryInfo> = {
  core: {
    id: "core",
    name: "Core",
    fullName: "Core Enterprise",
    tagline: "Quản trị Doanh nghiệp",
    description:
      "Các module nền tảng cho mọi doanh nghiệp: Kế toán, Nhân sự, CRM",
    color: "#22c55e",
  },
  commerce: {
    id: "commerce",
    name: "Commerce",
    fullName: "Commerce & Trade",
    tagline: "Thương mại & Bán hàng",
    description: "Thương mại điện tử, OTB, và khuyến mãi thương mại",
    color: "#06b6d4",
  },
  operations: {
    id: "operations",
    name: "Operations",
    fullName: "Operations & Manufacturing",
    tagline: "Sản xuất & Vận hành",
    description: "Hoạch định sản xuất, quản lý dự án, chuỗi cung ứng",
    color: "#8b5cf6",
  },
  intelligence: {
    id: "intelligence",
    name: "Intelligence",
    fullName: "AI & Intelligence",
    tagline: "Trí tuệ Nhân tạo",
    description: "AI-powered analytics, Excel AI",
    color: "#f59e0b",
  },
};

export const modules: Module[] = [
  // ═══ CORE ENTERPRISE ═══
  {
    id: "accounting",
    name: "VietERP Accounting",
    shortName: "Accounting",
    tagline: "Kế toán tuân thủ VAS TT200",
    description:
      "Hệ thống kế toán đầy đủ: sổ cái, công nợ, thuế GTGT, hoá đơn điện tử NĐ123, báo cáo tài chính theo TT200.",
    color: "#22c55e",
    icon: Calculator,
    port: 3007,
    features: [
      "VAS TT200 Compliance",
      "E-Invoice NĐ123",
      "VAT/PIT/CIT",
      "Bank Reconciliation",
    ],
    category: "core",
  },
  {
    id: "hrm",
    name: "VietERP HRM",
    shortName: "HRM",
    tagline: "Quản trị Nhân sự toàn diện (tích hợp AI)",
    description:
      "Quản lý nhân sự end-to-end: chấm công, tính lương, BHXH/BHYT/BHTN, tuyển dụng, đào tạo, KPI/OKR — tích hợp AI screening CV, dự đoán turnover và workforce analytics.",
    color: "#5e6ad2",
    icon: Users,
    port: 3003,
    features: [
      "BHXH/BHYT/BHTN",
      "Payroll VN",
      "ATS + CV Screening AI",
      "Performance OKR",
    ],
    category: "core",
  },
  {
    id: "crm",
    name: "VietERP CRM",
    shortName: "CRM",
    tagline: "Quản lý Khách hàng",
    description:
      "CRM đa kênh: quản lý lead, pipeline bán hàng, chăm sóc khách hàng, tích hợp Zalo/Facebook.",
    color: "#06b6d4",
    icon: Users2,
    port: 3018,
    features: [
      "Lead Management",
      "Sales Pipeline",
      "Zalo Integration",
      "Customer 360",
    ],
    category: "core",
  },

  // ═══ COMMERCE & TRADE ═══
  {
    id: "ecommerce",
    name: "VietERP Ecommerce",
    shortName: "Ecommerce",
    tagline: "Thương mại Điện tử",
    description:
      "Nền tảng TMĐT: quản lý sản phẩm, đơn hàng, thanh toán VNPay/MoMo, vận chuyển GHN/GHTK.",
    color: "#06b6d4",
    icon: ShoppingCart,
    port: 3008,
    features: [
      "VNPay/MoMo",
      "GHN/GHTK Shipping",
      "Multi-channel",
      "Inventory Sync",
    ],
    category: "commerce",
  },
  {
    id: "otb",
    name: "VietERP OTB",
    shortName: "OTB",
    tagline: "Open-To-Buy Planning",
    description:
      "Quản lý ngân sách mua hàng: dự báo demand, tối ưu inventory, margin planning cho Retail/FMCG.",
    color: "#ec4899",
    icon: Package,
    port: 3009,
    features: [
      "Demand Forecast",
      "Inventory Optimization",
      "Margin Planning",
      "Supplier Portal",
    ],
    category: "commerce",
  },
  {
    id: "tpm",
    name: "VietERP TPM",
    shortName: "TPM",
    tagline: "Trade Promotion Management",
    description:
      "Quản lý khuyến mãi thương mại: lập kế hoạch, phê duyệt, đối soát claim và phân tích ROI.",
    color: "#f59e0b",
    icon: Tag,
    port: 3010,
    features: [
      "Promotion Calendar",
      "Claim Settlement",
      "Budget Control",
      "ROI Analytics",
    ],
    category: "commerce",
  },

  // ═══ OPERATIONS & MANUFACTURING ═══
  {
    id: "mrp",
    name: "VietERP MRP",
    shortName: "MRP",
    tagline: "Hoạch định Sản xuất",
    description:
      "MRP/MES cho nhà máy: BOM, Work Orders, Quality Control, Inventory, IoT integration.",
    color: "#8b5cf6",
    icon: Factory,
    port: 3005,
    features: [
      "BOM Management",
      "Work Orders",
      "Quality NCR",
      "IoT Integration",
    ],
    category: "operations",
  },
  {
    id: "pm",
    name: "VietERP PM",
    shortName: "PM",
    tagline: "Quản lý Dự án",
    description:
      "Project Management: Kanban, Gantt, Sprint planning, resource allocation, timesheet.",
    color: "#14b8a6",
    icon: ClipboardList,
    port: 5173,
    features: [
      "Kanban Board",
      "Gantt Chart",
      "Sprint Planning",
      "Resource Allocation",
    ],
    category: "operations",
  },

  // ═══ AI & INTELLIGENCE ═══
  {
    id: "excel-ai",
    name: "VietERP ExcelAI",
    shortName: "ExcelAI",
    tagline: "Phân tích Excel bằng AI",
    description:
      "Upload Excel, AI tự động phân tích, tạo chart, pivot table, và insights từ dữ liệu kinh doanh.",
    color: "#f59e0b",
    icon: FileSpreadsheet,
    port: 5174,
    features: ["AI Analysis", "Auto Charts", "Pivot Tables", "Data Insights"],
    category: "intelligence",
  },
];

export const getModulesByCategory = (cat: ModuleCategory): Module[] => {
  return modules.filter((m) => m.category === cat);
};

export const getModuleById = (id: string): Module | undefined => {
  return modules.find((m) => m.id === id);
};

export const coreModules = getModulesByCategory("core");
export const commerceModules = getModulesByCategory("commerce");
export const operationsModules = getModulesByCategory("operations");
export const intelligenceModules = getModulesByCategory("intelligence");
