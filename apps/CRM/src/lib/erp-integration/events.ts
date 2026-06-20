// ============================================================
// CRM ↔ ERP event integration (NATS JetStream qua @vierp/events).
//
// - Publish: sự kiện front-office CRM (lead.converted, deal.won) + upsert Customer
//   canonical lên kênh master-data (erp.customer.*) để chống trùng giữa các app.
// - Subscribe: sự kiện vận hành từ CoVua (covua.>) để cập nhật view 360° trên
//   Contact phụ huynh (đóng học phí, gia hạn, điểm danh).
//
// CHỈ chạy ở Node runtime (server). Được nạp qua dynamic import từ instrumentation
// hoặc trong route handler server-side — không bao giờ vào bundle client.
// ============================================================
import { publish, subscribe } from "@vierp/events";
import { EVENT_SUBJECTS } from "@vierp/shared";
import { prisma } from "@/lib/prisma";
import { resolveIntakeOwnerId } from "@/lib/admissions/pipeline";

const CONSUMER_PREFIX = "crm";

export interface EventContext {
  tenantId?: string;
  userId?: string;
}

/** Subject NATS cho sự kiện front-office do CRM phát ra (phân biệt với CRM_EVENTS của event-bus nội bộ). */
export const CRM_NATS_SUBJECTS = {
  LEAD_CONVERTED: "crm.lead.converted",
  DEAL_WON: "crm.deal.won",
} as const;

function ctx(c: EventContext = {}) {
  return {
    tenantId: c.tenantId ?? "default",
    userId: c.userId ?? "system",
    source: "crm",
  };
}

/** No-op an toàn khi NATS chưa cấu hình (dev) — không chặn nghiệp vụ. */
function natsEnabled(): boolean {
  return Boolean(process.env.NATS_URL);
}

/** Phát một sự kiện CRM lên bus. */
export async function publishCRMEvent(
  subject: string,
  data: Record<string, unknown>,
  context: EventContext = {},
): Promise<void> {
  if (!natsEnabled()) return;
  await publish(subject, data, ctx(context));
}

/**
 * Đẩy Customer canonical lên kênh master-data (erp.customer.updated). Service
 * master-data (chủ sở hữu canonical store) sẽ ingest — CRM chỉ là producer, KHÔNG
 * chạy sync engine cục bộ.
 */
export async function publishCustomerUpsert(
  customer: {
    id: string;
    code?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    type?: "individual" | "company";
  },
  context: EventContext = {},
): Promise<void> {
  if (!natsEnabled()) return;
  await publish(
    EVENT_SUBJECTS.CUSTOMER.UPDATED,
    {
      id: customer.id,
      code: customer.code ?? customer.id,
      name: customer.name,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
      type: customer.type ?? "individual",
      status: "active",
    },
    ctx(context),
  );
}

// ==================== Subscribers (reverse-sync CoVua → CRM) ====================

/** Gắn toàn bộ consumer của CRM. Gọi một lần lúc khởi động (instrumentation). */
export async function startCrmEventHandlers(): Promise<void> {
  console.log("[CRM] Starting event handlers…");
  await Promise.all([
    subscribeCovuaPayment(),
    subscribeCovuaRenewal(),
    subscribeCovuaAttendance(),
    subscribeCovuaStudentUpdated(),
  ]);
  console.log("[CRM] Event handlers ready — listening covua.>");
}

/** Điểm danh từ CoVua → cập nhật "hoạt động gần nhất" trên Contact phụ huynh (không tạo Activity để tránh nhiễu). */
async function subscribeCovuaAttendance(): Promise<void> {
  await subscribe(
    "covua.attendance.recorded",
    `${CONSUMER_PREFIX}-covua-attendance`,
    async (event) => {
      const contact = await findParentContact(
        event.data as Record<string, unknown>,
      );
      if (!contact) return;
      await prisma.contact.update({
        where: { id: contact.id },
        data: { lastActivityAt: new Date() },
      });
    },
  );
}

/** Học viên đổi cấp/trạng thái bên CoVua → cập nhật cache level trên ContactChild (cho 360°). */
async function subscribeCovuaStudentUpdated(): Promise<void> {
  await subscribe(
    "covua.student.updated",
    `${CONSUMER_PREFIX}-covua-student`,
    async (event) => {
      const data = event.data as Record<string, unknown>;
      const studentId = data.studentId as string | undefined;
      if (!studentId) return;
      await prisma.contactChild.updateMany({
        where: { covuaStudentId: studentId },
        data: { level: (data.levelId as string) ?? undefined },
      });
    },
  );
}

/** Học phí từ CoVua → ghi nhận hoạt động + cập nhật 360° trên Contact phụ huynh. */
async function subscribeCovuaPayment(): Promise<void> {
  await subscribe(
    "covua.payment.received",
    `${CONSUMER_PREFIX}-covua-payment`,
    async (event) => {
      const data = event.data as Record<string, unknown>;
      const total =
        Number(data.totalAmount) ||
        Number(data.tuitionAmount || 0) +
          Number(data.bookAmount || 0) +
          Number(data.otherAmount || 0);
      const contact = await findParentContact(data);
      if (!contact) return;

      const systemUserId = await resolveIntakeOwnerId();
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contact.id },
          data: { lastActivityAt: new Date(), status: "CUSTOMER" },
        }),
        ...(systemUserId
          ? [
              prisma.activity.create({
                data: {
                  type: "NOTE",
                  subject: `Đã đóng học phí: ${total.toLocaleString("vi-VN")}đ`,
                  description: `Đồng bộ từ CoVua (HV ${data.studentName ?? data.studentId ?? "—"}).`,
                  isCompleted: true,
                  completedAt: new Date(),
                  contactId: contact.id,
                  userId: systemUserId,
                },
              }),
            ]
          : []),
      ]);
    },
  );
}

/** Yêu cầu gia hạn từ CoVua → đánh dấu để chăm sóc giữ chân. */
async function subscribeCovuaRenewal(): Promise<void> {
  await subscribe(
    "covua.renewal.requested",
    `${CONSUMER_PREFIX}-covua-renewal`,
    async (event) => {
      const data = event.data as Record<string, unknown>;
      const contact = await findParentContact(data);
      if (!contact) return;
      const systemUserId = await resolveIntakeOwnerId();
      if (!systemUserId) return;
      await prisma.activity.create({
        data: {
          type: "FOLLOW_UP",
          subject: "Phụ huynh yêu cầu gia hạn — cần chăm sóc",
          description: `Đồng bộ từ CoVua (HV ${data.studentName ?? data.studentId ?? "—"}).`,
          dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          contactId: contact.id,
          userId: systemUserId,
        },
      });
    },
  );
}

/** Tìm Contact phụ huynh từ payload CoVua: ưu tiên covuaParentId, rồi qua con (covuaStudentId). */
async function findParentContact(data: Record<string, unknown>) {
  const parentId = data.parentId as string | undefined;
  if (parentId) {
    const byParent = await prisma.contact.findFirst({
      where: { covuaParentId: parentId },
    });
    if (byParent) return byParent;
  }
  const studentId = data.studentId as string | undefined;
  if (studentId) {
    const child = await prisma.contactChild.findFirst({
      where: { covuaStudentId: studentId },
      select: { contactId: true },
    });
    if (child)
      return prisma.contact.findUnique({ where: { id: child.contactId } });
  }
  return null;
}
