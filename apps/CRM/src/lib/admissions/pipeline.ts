/**
 * Pipeline "Tuyển sinh Đào tạo" — phễu chăm lead đào tạo cờ vua được tách từ CoVua
 * (collection `Leads`, admin group "Tuyển sinh & CRM") sang CRM.
 *
 * Các stage gương theo `Leads.status` của CoVua để di trú dữ liệu 1-1.
 */
import { prisma } from "@/lib/prisma";

export const ADMISSIONS_PIPELINE_NAME = "Tuyển sinh Đào tạo";

/** Deal.dealType cho hồ sơ tuyển sinh (phân biệt với deal bán sách). */
export const ADMISSION_DEAL_TYPE = "ADMISSION";

/** Tên các stage — khớp Leads.status bên CoVua (moi/da_lien_he/dang_ky_hoc_thu/da_chot/khong_phu_hop). */
export const ADMISSION_STAGES = {
  NEW: "Mới",
  CONTACTED: "Đã liên hệ",
  TRIAL: "Đăng ký học thử",
  WON: "Đã chốt",
  UNFIT: "Không phù hợp",
} as const;

const STAGE_SEED = [
  { name: ADMISSION_STAGES.NEW, order: 0, probability: 10, color: "#6B7280" },
  {
    name: ADMISSION_STAGES.CONTACTED,
    order: 1,
    probability: 25,
    color: "#3B82F6",
  },
  { name: ADMISSION_STAGES.TRIAL, order: 2, probability: 50, color: "#8B5CF6" },
  {
    name: ADMISSION_STAGES.WON,
    order: 3,
    probability: 100,
    color: "#10B981",
    isWon: true,
  },
  {
    name: ADMISSION_STAGES.UNFIT,
    order: 4,
    probability: 0,
    color: "#EF4444",
    isLost: true,
  },
];

export type AdmissionsPipeline = {
  id: string;
  stages: {
    id: string;
    name: string;
    order: number;
    isWon: boolean;
    isLost: boolean;
  }[];
};

/**
 * Lấy (hoặc tạo lần đầu) pipeline tuyển sinh + các stage. Lazy-seed để endpoint
 * intake công khai tự khởi tạo phễu mà không cần chạy seed thủ công.
 */
export async function getOrCreateAdmissionsPipeline(): Promise<AdmissionsPipeline> {
  const existing = await prisma.pipelineConfig.findFirst({
    where: { name: ADMISSIONS_PIPELINE_NAME },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (existing) return existing;

  const created = await prisma.pipelineConfig.create({
    data: {
      name: ADMISSIONS_PIPELINE_NAME,
      isDefault: false, // KHÔNG đụng pipeline bán sách mặc định
      stages: { create: STAGE_SEED },
    },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  return created;
}

/** Tìm stage theo tên trong pipeline tuyển sinh. */
export function findStage(pipeline: AdmissionsPipeline, name: string) {
  return pipeline.stages.find((s) => s.name === name) ?? pipeline.stages[0];
}

/**
 * Chủ sở hữu mặc định cho lead đến từ form web (không có user đăng nhập).
 * Ưu tiên env INTAKE_OWNER_USER_ID → lễ tân → admin → bất kỳ user nào.
 */
export async function resolveIntakeOwnerId(): Promise<string | null> {
  const fromEnv = process.env.INTAKE_OWNER_USER_ID;
  if (fromEnv) {
    const u = await prisma.user.findUnique({ where: { id: fromEnv } });
    if (u) return u.id;
  }
  const preferred = await prisma.user.findFirst({
    where: { role: { in: ["RECEPTIONIST", "ADMIN", "MANAGER"] } },
    orderBy: { createdAt: "asc" },
  });
  if (preferred) return preferred.id;
  const any = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
  return any?.id ?? null;
}
