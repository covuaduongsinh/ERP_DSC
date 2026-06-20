import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import {
  ADMISSIONS_PIPELINE_NAME,
  ADMISSION_DEAL_TYPE,
} from "@/lib/admissions/pipeline";

/**
 * GET /api/analytics/admissions — Funnel tuyển sinh đào tạo + tỉ lệ chuyển đổi.
 * Dữ liệu CRM-native (deal dealType=ADMISSION trong pipeline "Tuyển sinh Đào tạo").
 */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser();
    const { searchParams } = req.nextUrl;
    const now = new Date();
    const fromDate = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : null;
    const toDate = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : null;
    const createdAt =
      fromDate || toDate
        ? {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          }
        : undefined;

    const pipeline = await prisma.pipelineConfig.findFirst({
      where: { name: ADMISSIONS_PIPELINE_NAME },
      include: { stages: { orderBy: { order: "asc" } } },
    });

    if (!pipeline) {
      return apiSuccess({
        pipeline: ADMISSIONS_PIPELINE_NAME,
        funnel: [],
        totals: { total: 0, won: 0, lost: 0, converted: 0, conversionRate: 0 },
        generatedAt: now.toISOString(),
      });
    }

    const baseWhere = {
      pipelineId: pipeline.id,
      dealType: ADMISSION_DEAL_TYPE,
      ...(createdAt ? { createdAt } : {}),
    };

    const grouped = await prisma.deal.groupBy({
      by: ["stageId"],
      where: baseWhere,
      _count: { _all: true },
    });
    const countByStage = new Map(
      grouped.map((g) => [g.stageId, g._count._all]),
    );

    const funnel = pipeline.stages.map((s) => ({
      stage: s.name,
      order: s.order,
      isWon: s.isWon,
      isLost: s.isLost,
      count: countByStage.get(s.id) ?? 0,
    }));

    const total = funnel.reduce((sum, f) => sum + f.count, 0);
    const won = funnel
      .filter((f) => f.isWon)
      .reduce((sum, f) => sum + f.count, 0);
    const lost = funnel
      .filter((f) => f.isLost)
      .reduce((sum, f) => sum + f.count, 0);
    // "Đã chuyển đổi" = thực sự đã tạo Học viên bên CoVua (handoff thành công).
    const converted = await prisma.deal.count({
      where: { ...baseWhere, covuaStudentId: { not: null } },
    });

    return apiSuccess({
      pipeline: pipeline.name,
      funnel,
      totals: {
        total,
        won,
        lost,
        converted,
        conversionRate: total > 0 ? Math.round((won / total) * 1000) / 10 : 0,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "/api/analytics/admissions");
  }
}
