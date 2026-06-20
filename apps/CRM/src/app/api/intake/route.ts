import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handleApiError, BadRequest, InternalError } from "@/lib/api/errors";
import { sanitizeObject } from "@/lib/api/sanitize";
import { getCurrentUserOrNull } from "@/lib/auth/get-current-user";
import { normalizePhone, isValidVietnamesePhone } from "@/lib/utils/phone";
import {
  getOrCreateAdmissionsPipeline,
  findStage,
  resolveIntakeOwnerId,
  ADMISSION_DEAL_TYPE,
  ADMISSION_STAGES,
} from "@/lib/admissions/pipeline";
import type { LeadSource } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/intake — Tiếp nhận lead tuyển sinh đào tạo từ form web CÔNG KHAI
 * (tư vấn / đăng ký học thử). Đây là cửa thay thế cho submitConsultation /
 * submitTrialRequest của CoVua sau khi tách "Tuyển sinh/CRM" sang CRM.
 *
 * Tạo Contact(status=LEAD) + Deal trong pipeline "Tuyển sinh Đào tạo". Dò trùng
 * theo SĐT đã chuẩn hóa để không tạo nhiều phụ huynh cho cùng một số.
 */
const intakeSchema = z.object({
  type: z.enum(["consultation", "trial"]).default("consultation"),
  fullName: z.string().min(1, "Thiếu họ tên").max(160),
  phone: z.string().min(1, "Thiếu số điện thoại").max(30),
  email: z.string().email().max(160).optional().nullable(),
  childName: z.string().max(160).optional().nullable(),
  childAge: z.string().max(40).optional().nullable(),
  interestedClassId: z.string().max(64).optional().nullable(),
  interestedLocationId: z.string().max(64).optional().nullable(),
  trialDate: z.string().datetime().optional().nullable(),
  source: z.enum(["google", "facebook", "gioi_thieu", "khac"]).optional(),
  note: z.string().max(2000).optional().nullable(),
  // Honeypot: field ẩn; bot tự điền → bỏ qua âm thầm (xử lý sau parse, không reject ở schema).
  website: z.string().optional(),
});

const SOURCE_MAP: Record<string, LeadSource> = {
  google: "ADVERTISEMENT",
  facebook: "SOCIAL_MEDIA",
  gioi_thieu: "REFERRAL",
  khac: "OTHER",
};

/** Tách họ tên VN: token cuối là tên (firstName), phần còn lại là họ (lastName). */
function splitVietnameseName(full: string): {
  firstName: string;
  lastName: string;
} {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return {
    firstName: parts[parts.length - 1],
    lastName: parts.slice(0, -1).join(" "),
  };
}

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json().catch(() => null);
    if (!raw) throw BadRequest("Body không hợp lệ");

    const parsed = intakeSchema.safeParse(raw);
    if (!parsed.success)
      throw BadRequest("Dữ liệu không hợp lệ", parsed.error.flatten());

    const data = sanitizeObject(
      parsed.data as Record<string, unknown>,
    ) as z.infer<typeof intakeSchema>;

    // Honeypot dính → giả vờ thành công, không ghi gì.
    if (data.website) return NextResponse.json({ ok: true });

    const phone = normalizePhone(data.phone);
    if (!isValidVietnamesePhone(phone))
      throw BadRequest("Số điện thoại không hợp lệ");

    // Chủ sở hữu: nếu staff đăng nhập thì gán cho họ, ngược lại owner mặc định.
    const staff = await getCurrentUserOrNull();
    const ownerId = staff?.id ?? (await resolveIntakeOwnerId());
    if (!ownerId) throw InternalError("Chưa có người dùng nào để gán lead");

    const { firstName, lastName } = splitVietnameseName(data.fullName);
    const source: LeadSource = data.source
      ? SOURCE_MAP[data.source]
      : "WEBSITE";

    // Dò trùng phụ huynh theo SĐT đã chuẩn hóa.
    const existing = await prisma.contact.findFirst({ where: { phone } });

    const contact =
      existing ??
      (await prisma.contact.create({
        data: {
          firstName,
          lastName,
          phone,
          email: data.email ?? null,
          source,
          status: "LEAD",
          ownerId,
        },
      }));

    // Gắn thông tin con (nếu có) — bỏ qua nếu đã có child trùng tên cho contact này.
    if (data.childName) {
      const dupChild = await prisma.contactChild.findFirst({
        where: { contactId: contact.id, fullName: data.childName },
      });
      if (!dupChild) {
        await prisma.contactChild.create({
          data: { contactId: contact.id, fullName: data.childName },
        });
      }
    }

    const pipeline = await getOrCreateAdmissionsPipeline();
    const stageName =
      data.type === "trial" ? ADMISSION_STAGES.TRIAL : ADMISSION_STAGES.NEW;
    const stage = findStage(pipeline, stageName);

    const deal = await prisma.deal.create({
      data: {
        title: `Tuyển sinh: ${data.childName || data.fullName}`,
        dealType: ADMISSION_DEAL_TYPE,
        stageId: stage.id,
        pipelineId: pipeline.id,
        ownerId,
        childAge: data.childAge ?? null,
        interestedClassId: data.interestedClassId ?? null,
        interestedLocationId: data.interestedLocationId ?? null,
        trialDate: data.trialDate ? new Date(data.trialDate) : null,
        notes: data.note ?? null,
        contacts: { create: [{ contactId: contact.id, isPrimary: true }] },
      },
    });

    return NextResponse.json(
      {
        ok: true,
        contactId: contact.id,
        dealId: deal.id,
        reusedContact: Boolean(existing),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "/api/intake");
  }
}
