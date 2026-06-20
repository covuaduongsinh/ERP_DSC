import { prisma } from "@/lib/prisma";
import { convertAdmission } from "@/lib/integrations/clb";
import { fullNameOf } from "@/lib/erp-integration/master-data";

/**
 * Handoff CRM → CLB khi một Deal "Tuyển sinh Đào tạo" được chốt (vào stage isWon).
 *
 * Tạo Phụ huynh + Học viên + Ghi danh bên CLB (qua endpoint nội bộ), rồi lưu
 * cross-id về CRM để chống tạo trùng lần sau. Best-effort: nếu CLB offline / lỗi,
 * KHÔNG đánh dấu đã chuyển đổi ⇒ lần "chốt" sau sẽ thử lại.
 *
 * Các sự kiện NATS (customer canonical + crm.lead.converted) được nạp qua dynamic
 * import để `nats` KHÔNG lọt vào graph tĩnh của route handler.
 */
export async function handleAdmissionWon(dealId: string): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    include: {
      contacts: { include: { contact: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  if (!deal || deal.clbStudentId) return; // không có deal hoặc đã chuyển đổi

  const primary = deal.contacts[0]?.contact;
  if (!primary || !primary.phone) {
    console.warn(
      `[CRM] Deal ${dealId} chốt nhưng thiếu Contact/SĐT — bỏ qua handoff.`,
    );
    return;
  }

  const child = await prisma.contactChild.findFirst({
    where: { contactId: primary.id },
    orderBy: { createdAt: "asc" },
  });

  const result = await convertAdmission({
    customerId: primary.customerId ?? undefined,
    parent: {
      fullName: fullNameOf(primary),
      phone: primary.phone,
      email: primary.email,
    },
    student: {
      fullName: child?.fullName ?? `Con ${fullNameOf(primary)}`,
      dob: child?.dob ? child.dob.toISOString() : null,
      locationId: deal.interestedLocationId,
    },
    classId: deal.interestedClassId,
    sourceDealId: deal.id,
    startDate: deal.trialDate ? deal.trialDate.toISOString() : null,
  });

  if (!result) {
    console.warn(
      `[CRM] Handoff CLB chưa thành công cho deal ${dealId} — sẽ thử lại lần chốt sau.`,
    );
    return;
  }

  // Lưu cross-id (chống tạo trùng) + đóng dấu thời điểm chuyển đổi.
  await prisma.$transaction([
    prisma.deal.update({
      where: { id: deal.id },
      data: {
        clbParentId: result.parentId,
        clbStudentId: result.studentId,
        clbEnrollmentId: result.enrollmentId ?? null,
        convertedAt: new Date(),
      },
    }),
    prisma.contact.update({
      where: { id: primary.id },
      data: { clbParentId: result.parentId, status: "CUSTOMER" },
    }),
    ...(child
      ? [
          prisma.contactChild.update({
            where: { id: child.id },
            data: { clbStudentId: result.studentId },
          }),
        ]
      : []),
  ]);

  // Đẩy Customer canonical + sự kiện chuyển đổi lên bus (best-effort, no-op khi tắt NATS).
  try {
    const { publishCustomerUpsert, publishCRMEvent, CRM_NATS_SUBJECTS } =
      await import("@/lib/erp-integration/events");
    await publishCustomerUpsert({
      id: primary.customerId ?? primary.id,
      name: fullNameOf(primary),
      email: primary.email,
      phone: primary.phone,
    });
    await publishCRMEvent(CRM_NATS_SUBJECTS.LEAD_CONVERTED, {
      dealId: deal.id,
      contactId: primary.id,
      clbParentId: result.parentId,
      clbStudentId: result.studentId,
    });
  } catch (e) {
    console.error("[CRM] publish customer/lead.converted lỗi:", e);
  }
}
