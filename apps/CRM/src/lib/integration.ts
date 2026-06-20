/**
 * Cross-module integration layer
 * CRM can call other VietERP modules via REST API
 * All calls have graceful fallback when modules are offline
 */

export interface ModuleConfig {
  name: string;
  label: string;
  port: number;
  baseUrl: string;
  color: string;
  icon: string; // lucide icon name
  description: string;
}

const MODULE_REGISTRY: Record<string, ModuleConfig> = {
  mrp: {
    name: "mrp",
    label: "MRP",
    port: 3011,
    baseUrl: process.env.NEXT_PUBLIC_MRP_URL || "http://localhost:3011",
    color: "#10B981",
    icon: "Factory",
    description: "Quản lý sản xuất",
  },
  otb: {
    name: "otb",
    label: "OTB",
    port: 3012,
    baseUrl: process.env.NEXT_PUBLIC_OTB_URL || "http://localhost:3012",
    color: "#3B82F6",
    icon: "BarChart3",
    description: "Quản lý ngân sách",
  },
  hrm: {
    name: "hrm",
    label: "HRM",
    port: 3013,
    baseUrl: process.env.NEXT_PUBLIC_HRM_URL || "http://localhost:3013",
    color: "#8B5CF6",
    icon: "Users",
    description: "Quản lý nhân sự",
  },
  tpm: {
    name: "tpm",
    label: "TPM",
    port: 3014,
    baseUrl: process.env.NEXT_PUBLIC_TPM_URL || "http://localhost:3014",
    color: "#F59E0B",
    icon: "Megaphone",
    description: "Quản lý khuyến mại",
  },
  sheets: {
    name: "sheets",
    label: "Sheets",
    port: 3015,
    baseUrl: process.env.NEXT_PUBLIC_SHEETS_URL || "http://localhost:3015",
    color: "#06B6D4",
    icon: "Table",
    description: "Bảng tính thông minh",
  },
  mail: {
    name: "mail",
    label: "Mail",
    port: 3007,
    baseUrl: process.env.NEXT_PUBLIC_MAIL_URL || "http://localhost:3007",
    color: "#EF4444",
    icon: "Mail",
    description: "Email thông minh",
  },
  covua: {
    name: "covua",
    label: "CoVua",
    port: 3020,
    baseUrl: process.env.NEXT_PUBLIC_COVUA_URL || "http://localhost:3020",
    color: "#14B8A6",
    icon: "GraduationCap",
    description: "Đào tạo cờ vua (CLB)",
  },
};

export function getModuleConfig(moduleName: string): ModuleConfig | undefined {
  return MODULE_REGISTRY[moduleName];
}

export function getAllModules(): ModuleConfig[] {
  return Object.values(MODULE_REGISTRY);
}

/**
 * Call a module's internal API
 * Returns null if the module is offline
 */
export async function callModule(
  moduleName: string,
  path: string,
  options?: RequestInit,
): Promise<any> {
  const config = MODULE_REGISTRY[moduleName];
  if (!config) throw new Error(`Unknown module: ${moduleName}`);

  const url = `${config.baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Source": "vierp-crm",
        ...options?.headers,
      },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // Module offline — graceful fallback
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if a module is online
 */
export async function checkModuleHealth(moduleName: string): Promise<boolean> {
  const result = await callModule(moduleName, "/api/health");
  return result !== null;
}

/**
 * Check health of all modules
 */
export async function checkAllModulesHealth(): Promise<
  Record<string, boolean>
> {
  const results: Record<string, boolean> = {};
  const checks = Object.keys(MODULE_REGISTRY).map(async (name) => {
    results[name] = await checkModuleHealth(name);
  });
  await Promise.allSettled(checks);
  return results;
}
