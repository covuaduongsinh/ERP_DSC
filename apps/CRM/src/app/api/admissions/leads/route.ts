import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { handleApiError } from "@/lib/api/errors";
import { apiSuccess } from "@/lib/api/response";
import { ADMISSION_DEAL_TYPE } from "@/lib/admissions/pipeline";

export const dynamic = "force-dynamic";

/**
 * GET /api/admissions/leads — Danh sách hồ sơ lead tuyển sinh (deal dealType=ADMISSION)
 * kèm phụ huynh (contact chính) + con đầu tiên, để hiển thị bảng quản lý lead.
 */
export async function GET(req: NextRequest) {
  try {
    await getCurrentUser();
    const { searchParams } = req.nextUrl;
    const stageId = searchParams.get("stageId") || undefined;
    const q = searchParams.get("q")?.trim();

    const deals = await prisma.deal.findMany({
      where: {
        dealType: ADMISSION_DEAL_TYPE,
        ...(stageId ? { stageId } : {}),
        ...(q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                {
                  contacts: {
                    some: {
                      contact: {
                        OR: [
                          { firstName: { contains: q, mode: "insensitive" } },
                          { lastName: { contains: q, mode: "insensitive" } },
                          { phone: { contains: q } },
                        ],
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        stage: {
          select: {
            id: true,
            name: true,
            color: true,
            isWon: true,
            isLost: true,
          },
        },
        owner: { select: { id: true, name: true } },
        contacts: {
          orderBy: { isPrimary: "desc" },
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
                children: {
                  orderBy: { createdAt: "asc" },
                  take: 1,
                  select: { id: true, fullName: true },
                },
              },
            },
          },
        },
      },
    });

    const data = deals.map((d) => {
      const contact = d.contacts[0]?.contact ?? null;
      const child = contact?.children?.[0] ?? null;
      return {
        id: d.id,
        title: d.title,
        stageId: d.stageId,
        stage: d.stage,
        childAge: d.childAge,
        interestedClassId: d.interestedClassId,
        interestedLocationId: d.interestedLocationId,
        trialDate: d.trialDate,
        clbStudentId: d.clbStudentId,
        convertedAt: d.convertedAt,
        createdAt: d.createdAt,
        owner: d.owner,
        contact: contact
          ? {
              id: contact.id,
              firstName: contact.firstName,
              lastName: contact.lastName,
              phone: contact.phone,
              email: contact.email,
            }
          : null,
        child: child ? { id: child.id, fullName: child.fullName } : null,
      };
    });

    return apiSuccess({ data });
  } catch (error) {
    return handleApiError(error, "/api/admissions/leads");
  }
}
