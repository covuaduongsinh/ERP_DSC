import { prisma } from "@/lib/prisma";
import type {
  SettingsKey,
  SettingsMap,
  CompanySettings,
  PipelineSettings,
  NotificationSettings,
  EmailSettings,
  OrderSettings,
} from "./types";

export type {
  SettingsKey,
  SettingsMap,
  CompanySettings,
  PipelineSettings,
  NotificationSettings,
  EmailSettings,
  OrderSettings,
};
export type { PipelineStage } from "./types";

// ── Default Settings ────────────────────────────────────────────────

export const DEFAULT_SETTINGS: SettingsMap = {
  company: {
    name: "Cờ vua Dương Sinh CRM",
    address: "",
    phone: "",
    email: "",
    website: "",
    taxId: "",
  },
  pipeline: {
    stages: [
      {
        id: "new-lead",
        name: "New Lead",
        color: "#6B7280",
        probability: 10,
        order: 0,
      },
      {
        id: "qualification",
        name: "Qualification",
        color: "#3B82F6",
        probability: 20,
        order: 1,
      },
      {
        id: "proposal",
        name: "Proposal",
        color: "#8B5CF6",
        probability: 50,
        order: 2,
      },
      {
        id: "negotiation",
        name: "Negotiation",
        color: "#F59E0B",
        probability: 75,
        order: 3,
      },
      {
        id: "closed-won",
        name: "Closed Won",
        color: "#10B981",
        probability: 100,
        order: 4,
      },
      {
        id: "closed-lost",
        name: "Closed Lost",
        color: "#EF4444",
        probability: 0,
        order: 5,
      },
    ],
  },
  notifications: {
    quoteExpiryReminder: true,
    quoteExpiryDays: 3,
    dealStaleAlertDays: 14,
    emailOnNewDeal: false,
  },
  email: {
    fromName: "Cờ vua Dương Sinh CRM",
    fromEmail:
      process.env.EMAIL_FROM?.match(/<(.+)>/)?.[1] ||
      process.env.EMAIL_FROM ||
      "",
    replyTo: "",
    signature: "",
  },
  order: {
    autoOrderFromQuote: true,
  },
};

// ── Service Functions ───────────────────────────────────────────────

/**
 * Get a single setting by key. Returns null if not set.
 */
export async function getSetting<K extends SettingsKey>(
  key: K,
): Promise<SettingsMap[K] | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  if (!row) return null;
  return row.value as unknown as SettingsMap[K];
}

/**
 * Get a setting merged with defaults (deep merge — DB values override defaults).
 */
export async function getSettingOrDefault<K extends SettingsKey>(
  key: K,
): Promise<SettingsMap[K]> {
  const row = await prisma.setting.findUnique({ where: { key } });
  const defaults = DEFAULT_SETTINGS[key];
  if (!row) return defaults;
  return deepMerge(
    defaults as unknown as Record<string, unknown>,
    row.value as Record<string, unknown>,
  ) as unknown as SettingsMap[K];
}

/**
 * Save a setting (upsert).
 */
export async function setSetting(
  key: SettingsKey,
  value: unknown,
  userId: string,
): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as any, updatedBy: userId },
    update: { value: value as any, updatedBy: userId },
  });
}

/**
 * Get all settings merged with defaults.
 */
export async function getAllSettings(): Promise<SettingsMap> {
  const rows = await prisma.setting.findMany();
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));

  const result = {} as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
    const dbValue = dbMap.get(key);
    if (dbValue) {
      result[key] = deepMerge(
        DEFAULT_SETTINGS[key] as unknown as Record<string, unknown>,
        dbValue as Record<string, unknown>,
      );
    } else {
      result[key] = DEFAULT_SETTINGS[key];
    }
  }

  return result as SettingsMap;
}

// ── Deep Merge Helper ───────────────────────────────────────────────

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const tVal = target[key];
    const sVal = source[key];
    if (
      tVal &&
      sVal &&
      typeof tVal === "object" &&
      typeof sVal === "object" &&
      !Array.isArray(tVal) &&
      !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(
        tVal as Record<string, unknown>,
        sVal as Record<string, unknown>,
      );
    } else {
      result[key] = sVal;
    }
  }
  return result;
}
