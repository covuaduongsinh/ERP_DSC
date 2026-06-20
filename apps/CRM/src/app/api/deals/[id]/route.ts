import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/webhooks";
import { eventBus } from "@/lib/events/event-bus";
import { CRM_EVENTS } from "@/lib/events/types";
import { getCurrentUser, AuthError } from "@/lib/auth/get-current-user";
import {
  requireOwnerOrRole,
  isErrorResponse,
  forbiddenResponse,
  canAccess,
} from "@/lib/auth/rbac";
import { validateRequest, updateDealSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/api/errors";
import { getChecklistTemplate } from "@/lib/compliance/checklist-templates";
import { calculateHealthScore } from "@/lib/analytics/health-score";
import { ADMISSION_DEAL_TYPE } from "@/lib/admissions/pipeline";
import { handleAdmissionWon } from "@/lib/admissions/handoff";

// GET /api/deals/[id] — Get deal with all relations
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getCurrentUser();
    const { id } = params;

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        stage: true,
        pipeline: { select: { id: true, name: true } },
        company: {
          include: {
            parent: { select: { id: true, name: true } },
            children: { select: { id: true, name: true } },
          },
        },
        contacts: {
          include: {
            contact: {
              include: {
                tags: { include: { tag: true } },
                // Con của phụ huynh — phục vụ view chi tiết lead tuyển sinh.
                children: {
                  orderBy: { createdAt: "asc" },
                  select: {
                    id: true,
                    fullName: true,
                    level: true,
                    clbStudentId: true,
                  },
                },
              },
            },
          },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        quotes: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { items: true } },
          },
        },
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            _count: { select: { items: true } },
          },
        },
        tags: { include: { tag: true } },
        owner: {
          select: { id: true, name: true, email: true, avatarUrl: true },
        },
        partner: { include: { company: { select: { id: true, name: true } } } },
        checklists: { orderBy: { key: "asc" } },
        _count: { select: { documents: true, contacts: true } },
      },
    });

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    if (!canAccess(user, "view_all") && deal.ownerId !== user.id) {
      return forbiddenResponse();
    }

    // Calculate live health score
    const healthScore = calculateHealthScore({
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      lastActivityAt: deal.lastActivityAt,
      stage: { probability: deal.stage?.probability ?? 50 },
      contactCount: deal._count.contacts,
      documentCount: deal._count.documents,
      complianceStatus: deal.complianceStatus,
    });

    return NextResponse.json({ ...deal, healthScore });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }
    console.error("GET /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch deal" },
      { status: 500 },
    );
  }
}

// PATCH /api/deals/[id] — Update deal
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const existing = await prisma.deal.findUnique({
      where: { id },
      select: { ownerId: true, stageId: true, stage: true, dealType: true },
    });
    if (!existing)
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const result = await requireOwnerOrRole(existing.ownerId, [
      "ADMIN",
      "MANAGER",
    ]);
    if (isErrorResponse(result)) return result;

    const body = await req.json();
    const { contactIds, contacts, ...updateData } = validateRequest(
      updateDealSchema,
      body,
    );

    // Auto-set closedAt when deal moves to a won/lost stage
    let autoClosedAt: Date | undefined;
    if (updateData.stageId && updateData.stageId !== existing.stageId) {
      const newStage = await prisma.stage.findUnique({
        where: { id: updateData.stageId },
        select: { isWon: true, isLost: true },
      });
      if (newStage && (newStage.isWon || newStage.isLost)) {
        autoClosedAt = new Date();
      }
    }

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        ...updateData,
        ...(autoClosedAt && !updateData.closedAt
          ? { closedAt: autoClosedAt }
          : {}),
      },
      include: {
        stage: true,
        company: { select: { id: true, name: true } },
        contacts: { include: { contact: true } },
        owner: { select: { id: true, name: true, avatarUrl: true } },
        partner: { include: { company: { select: { id: true, name: true } } } },
      },
    });

    // Auto-create checklist if dealType changed
    if (updateData.dealType && updateData.dealType !== existing.dealType) {
      const existingChecklist = await prisma.dealChecklist.count({
        where: { dealId: id },
      });
      if (existingChecklist === 0) {
        const template = getChecklistTemplate(updateData.dealType);
        if (template.length > 0) {
          await prisma.dealChecklist.createMany({
            data: template.map((item) => ({
              dealId: id,
              key: item.key,
              label: item.labelKey,
            })),
          });
        }
      }
    }

    // Recalculate health score after update
    const [contactCount, documentCount] = await Promise.all([
      prisma.dealContact.count({ where: { dealId: id } }),
      prisma.document.count({ where: { dealId: id } }),
    ]);
    const newHealthScore = calculateHealthScore({
      createdAt: deal.createdAt,
      updatedAt: deal.updatedAt,
      lastActivityAt: (deal as any).lastActivityAt,
      stage: { probability: deal.stage?.probability ?? 50 },
      contactCount,
      documentCount,
      complianceStatus: deal.complianceStatus,
    });
    await prisma.deal.update({
      where: { id },
      data: { healthScore: newHealthScore },
    });

    // Emit webhook events
    if (updateData.stageId && existing.stageId !== updateData.stageId) {
      emitEvent("crm.deal.stage_changed", {
        dealId: deal.id,
        title: deal.title,
        oldStageId: existing.stageId,
        newStageId: deal.stageId,
        newStageName: deal.stage?.name,
        value: deal.value,
        companyId: deal.companyId,
        companyName: deal.company?.name,
      }).catch(() => {});
    }

    if (deal.stage?.isWon) {
      emitEvent("crm.deal.won", {
        dealId: deal.id,
        title: deal.title,
        value: deal.value,
        companyId: deal.companyId,
        companyName: deal.company?.name,
      }).catch(() => {});

      // Fire EventBus DEAL_WON for commission auto-creation
      eventBus
        .emit(CRM_EVENTS.DEAL_WON, {
          dealId: deal.id,
          deal: { title: deal.title, value: Number(deal.value) },
          timestamp: new Date().toISOString(),
        })
        .catch(() => {});

      // Handoff tuyển sinh: Deal đào tạo "Đã chốt" → tạo Parent+Student+Enrollment bên CLB
      // (idempotent; best-effort — không chặn cập nhật deal nếu CLB offline).
      if (existing.dealType === ADMISSION_DEAL_TYPE && !deal.clbStudentId) {
        await handleAdmissionWon(deal.id).catch((e) =>
          console.error("[CRM] handoff CLB thất bại:", e),
        );
      }
    }

    return NextResponse.json(deal);
  } catch (error) {
    return handleApiError(error, "/api/deals/[id]");
  }
}

// DELETE /api/deals/[id] — Delete deal
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const existing = await prisma.deal.findUnique({
      where: { id },
      select: { ownerId: true },
    });
    if (!existing)
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });

    const result = await requireOwnerOrRole(existing.ownerId, [
      "ADMIN",
      "MANAGER",
    ]);
    if (isErrorResponse(result)) return result;

    await prisma.deal.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === "P2025")
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    console.error("DELETE /api/deals/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 },
    );
  }
}
