// ============================================================
// @vierp/events - CLB (Cờ vua Dương Sinh) Event Schemas
// Sự kiện từ module CLB (trung tâm dạy cờ) phát lên NATS để đồng bộ ERP:
//   clb.payment.received → Accounting (ghi nhận doanh thu học phí)
//   clb.coach.upserted   → HRM (đồng bộ giáo viên ↔ nhân sự)
//   clb.lead.captured    → CRM (gom lead tuyển sinh)
// ============================================================

import { z } from "zod";

/**
 * TuitionPaymentReceived - Một lần nộp học phí (THU) tại trung tâm.
 * Kích hoạt: tạo bản ghi Payments trong Payload (afterChange, operation=create).
 * Đích: Accounting → JournalEntryPosted (Nợ Tiền / Có Doanh thu).
 */
export const TuitionPaymentReceivedSchema = z.object({
  paymentId: z.string().min(1),
  code: z.string().optional(), // mã chứng từ (PAYMENT_CODE_SPEC)
  studentId: z.string().min(1),
  studentName: z.string().optional(),
  paymentDate: z.string().datetime(),
  // Tách 3 khoản để Accounting ghi đúng tài khoản doanh thu:
  tuitionAmount: z.number().nonnegative().default(0), // học phí (hocPhi)
  bookAmount: z.number().nonnegative().default(0), // tiền sách (tienSach)
  otherAmount: z.number().nonnegative().default(0), // mua khác (muaKhac)
  totalAmount: z.number().positive(),
  currency: z.string().default("VND"),
  location: z.string().optional(), // cơ sở (coSo): kim_lien | vinh_phuc
  status: z.string().optional(), // tinhTrang: da_nop | cho
});

export type TuitionPaymentReceived = z.infer<
  typeof TuitionPaymentReceivedSchema
>;

/**
 * CoachUpserted - Giáo viên (coach) được tạo/cập nhật.
 * Đích: HRM → đồng bộ thành Employee (giáo viên cũng là nhân sự).
 */
export const CoachUpsertedSchema = z.object({
  coachId: z.string().min(1),
  fullName: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  active: z.boolean().default(true),
  location: z.string().optional(),
});

export type CoachUpserted = z.infer<typeof CoachUpsertedSchema>;

/**
 * LeadCaptured - Lead tuyển sinh mới (phụ huynh quan tâm khóa học).
 * Đích: CRM → gom vào pipeline lead chung của ERP.
 */
export const LeadCapturedSchema = z.object({
  leadId: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  childAge: z.number().int().optional(),
  interestedLocation: z.string().optional(),
  stage: z.string().optional(),
});

export type LeadCaptured = z.infer<typeof LeadCapturedSchema>;

/** Export tất cả schema sự kiện CLB (subject → schema). */
export const CLBEventSchemas = {
  "clb.payment.received": TuitionPaymentReceivedSchema,
  "clb.coach.upserted": CoachUpsertedSchema,
  "clb.lead.captured": LeadCapturedSchema,
} as const;
