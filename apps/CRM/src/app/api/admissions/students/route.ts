import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/admissions/students — Học viên đã chuyển đổi (ContactChild có clbStudentId)
 * kèm phụ huynh. CLB là SoR; ở đây chỉ liệt kê để mở view 360° (đọc qua proxy summary).
 */
export async function GET(_req: NextRequest) {
  try {
    await getCurrentUser();

    const children = await prisma.contactChild.findMany({
      where: { clbStudentId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
    });

    const data = children.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      level: c.level,
      clbStudentId: c.clbStudentId,
      contact: c.contact,
    }));

    return apiSuccess({ data });
  } catch (error) {
    return handleApiError(error, "/api/admissions/students");
  }
}
