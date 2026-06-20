import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import {
  ADMISSIONS_PIPELINE_NAME,
  ADMISSION_DEAL_TYPE,
  getOrCreateAdmissionsPipeline,
} from "@/lib/admissions/pipeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/admissions/pipeline — Pipeline "Tuyển sinh Đào tạo" kèm các stage và
 * deal (lọc dealType=ADMISSION) cho bảng Kanban tuyển sinh.
 *
 * Trả về cùng shape với /api/pipeline (spread pipeline + stages) để tái dùng
 * KanbanBoard. Lazy-seed pipeline nếu chưa tồn tại.
 */
export async function GET(_req: NextRequest) {
  try {
    await getCurrentUser();

    // Đảm bảo pipeline + stage đã tồn tại (tự seed lần đầu).
    await getOrCreateAdmissionsPipeline();

    const pipeline = await prisma.pipelineConfig.findFirst({
      where: { name: ADMISSIONS_PIPELINE_NAME },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            deals: {
              where: { dealType: ADMISSION_DEAL_TYPE },
              orderBy: { updatedAt: "desc" },
              include: {
                stage: {
                  select: {
                    id: true,
                    name: true,
                    color: true,
                    probability: true,
                  },
                },
                company: { select: { id: true, name: true } },
                contacts: {
                  include: {
                    contact: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        avatarUrl: true,
                      },
                    },
                  },
                },
                owner: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { activities: true } },
              },
            },
          },
        },
      },
    });

    if (!pipeline) {
      return apiSuccess({ name: ADMISSIONS_PIPELINE_NAME, stages: [] });
    }

    const stagesWithTotals = pipeline.stages.map((stage) => ({
      ...stage,
      totalValue: stage.deals.reduce((sum, d) => sum + Number(d.value), 0),
      dealCount: stage.deals.length,
    }));

    return apiSuccess({ ...pipeline, stages: stagesWithTotals });
  } catch (error) {
    return handleApiError(error, "/api/admissions/pipeline");
  }
}
