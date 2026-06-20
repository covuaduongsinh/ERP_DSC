// ============================================================
// @vierp/events - Event Flow: CLB → Accounting
// clb.payment.received → JournalEntryPosted (ghi nhận doanh thu học phí)
// Nợ Tiền (1111) / Có Doanh thu dịch vụ (5113) + bán sách (5111) + khác (711)
// ============================================================

import type { TuitionPaymentReceived } from "../schemas/clb.events";
import type { JournalEntryPosted } from "../schemas/accounting.events";
import type { BaseEvent } from "../types";

/** Bảng tài khoản (VAS rút gọn) cho nghiệp vụ THU của trung tâm. */
const ChartOfAccounts = {
  CASH: "1111", // Tiền mặt VND
  SERVICE_REVENUE: "5113", // Doanh thu cung cấp dịch vụ (học phí)
  GOODS_REVENUE: "5111", // Doanh thu bán hàng (tiền sách)
  OTHER_INCOME: "711", // Thu nhập khác (mua khác)
} as const;

const AccountNames: Record<string, string> = {
  [ChartOfAccounts.CASH]: "Tiền mặt",
  [ChartOfAccounts.SERVICE_REVENUE]: "Doanh thu học phí",
  [ChartOfAccounts.GOODS_REVENUE]: "Doanh thu bán sách",
  [ChartOfAccounts.OTHER_INCOME]: "Thu nhập khác",
};

/**
 * Map clb.payment.received → JournalEntryPosted.
 * Bút toán: Nợ 1111 (tổng thực thu) / Có 5113 + 5111 + 711 (theo từng khoản > 0).
 */
export async function mapTuitionPaymentToJournalEntry(
  event: BaseEvent<TuitionPaymentReceived>,
): Promise<JournalEntryPosted> {
  const { payload } = event;
  const journalDate = payload.paymentDate || new Date().toISOString();
  const journalNumber = `JE-CLB-${payload.code || payload.paymentId}`;

  const lines: JournalEntryPosted["lines"] = [];
  let lineCounter = 0;

  // Nợ: Tiền mặt — tổng thực thu
  lines.push({
    lineId: `line-${++lineCounter}`,
    accountCode: ChartOfAccounts.CASH,
    accountName: AccountNames[ChartOfAccounts.CASH],
    description: `Thu học phí ${payload.studentName || payload.studentId} (${payload.code || payload.paymentId})`,
    debitAmount: payload.totalAmount,
    creditAmount: 0,
    costCenterCode: payload.location,
  });

  // Có: từng nguồn doanh thu có giá trị > 0
  const credits: Array<[string, number]> = [
    [ChartOfAccounts.SERVICE_REVENUE, payload.tuitionAmount || 0],
    [ChartOfAccounts.GOODS_REVENUE, payload.bookAmount || 0],
    [ChartOfAccounts.OTHER_INCOME, payload.otherAmount || 0],
  ];
  for (const [accountCode, amount] of credits) {
    if (amount > 0) {
      lines.push({
        lineId: `line-${++lineCounter}`,
        accountCode,
        accountName: AccountNames[accountCode],
        description: `Ghi nhận doanh thu — ${AccountNames[accountCode]}`,
        debitAmount: 0,
        creditAmount: amount,
        costCenterCode: payload.location,
      });
    }
  }

  const totalCredit = credits.reduce((s, [, a]) => s + (a > 0 ? a : 0), 0);

  return {
    journalEntryId: `je-${Date.now()}`,
    journalNumber,
    journalDate,
    postDate: journalDate,
    description: `Bút toán thu học phí CLB — ${payload.code || payload.paymentId}`,
    sourceEvent: "payment",
    sourceDocumentId: payload.paymentId,
    totalDebit: payload.totalAmount,
    totalCredit: totalCredit || payload.totalAmount,
    currency: payload.currency || "VND",
    lines,
    notes: `Tự sinh từ clb.payment.received. Cơ sở: ${payload.location || "n/a"}.`,
    postedBy: "system",
  };
}

/** Metadata flow CLB → Accounting (đăng ký trong FlowRegistry). */
export const CLBToAccountingFlow = {
  triggers: ["clb.payment.received"],
  target: "accounting.journal.posted",
  mapper: mapTuitionPaymentToJournalEntry,
};

/** Kiểm tra cân đối Nợ/Có của bút toán sinh ra. */
export function validateTuitionJournal(entry: JournalEntryPosted): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (entry.lines.length < 2) errors.push("Bút toán phải có ít nhất 2 dòng");
  const totalDebit = entry.lines.reduce((s, l) => s + l.debitAmount, 0);
  const totalCredit = entry.lines.reduce((s, l) => s + l.creditAmount, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    errors.push(`Nợ (${totalDebit}) ≠ Có (${totalCredit})`);
  }
  return { valid: errors.length === 0, errors };
}
