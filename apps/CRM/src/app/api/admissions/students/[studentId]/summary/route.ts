import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import { getStudentSummary } from "@/lib/integrations/clb";

export const dynamic = "force-dynamic";

/**
 * GET /api/admissions/students/:studentId/summary — Proxy bản tóm tắt 360° học viên
 * từ CLB (SoR vận hành đào tạo). Trả { summary: null } khi CLB offline / thiếu token.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { studentId: string } },
) {
  try {
    await getCurrentUser();
    const summary = await getStudentSummary(params.studentId);
    return apiSuccess({ summary });
  } catch (error) {
    return handleApiError(
      error,
      "/api/admissions/students/[studentId]/summary",
    );
  }
}
