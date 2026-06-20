/**
 * CLB (CLB / đào tạo cờ vua) integration client.
 *
 * CRM là front-office tuyển sinh; CLB là hệ vận hành đào tạo (SoR cho học viên,
 * lớp, buổi học, điểm danh, học phí). Khi một Deal "Tuyển sinh" được chốt, CRM gọi
 * CLB để tạo Phụ huynh + Học viên + Ghi danh. CRM cũng đọc bản tóm tắt học viên
 * để dựng view 360° trên Contact.
 *
 * Mọi lời gọi đi qua `callModule('clb', …)` — có timeout + graceful fallback
 * (trả null khi CLB offline), nên KHÔNG chặn nghiệp vụ CRM khi CLB tạm ngừng.
 */
import { callModule } from "@/lib/integration";

/** Dữ liệu gửi sang CLB để chuyển lead đã chốt thành Phụ huynh + Học viên + Ghi danh. */
export interface AdmissionConvertInput {
  /** Khử trùng: id Customer canonical (master-data) nếu đã có. */
  customerId?: string;
  parent: {
    fullName: string;
    phone: string;
    email?: string | null;
    zaloId?: string | null;
  };
  student: {
    fullName: string;
    dob?: string | null;
    /** Cấp/level CLB (id) nếu biết. */
    levelId?: string | null;
    /** Cơ sở CLB (id) nếu biết. */
    locationId?: string | null;
  };
  /** Lớp ghi danh (id CLB) nếu phụ huynh đã chọn. */
  classId?: string | null;
  /** Dấu vết nguồn để CLB đối soát (deal id CRM). */
  sourceDealId?: string;
  /** Ngày bắt đầu học dự kiến (ISO). */
  startDate?: string | null;
}

/** Kết quả chuyển đổi — các id CLB để CRM lưu ngược (chống tạo trùng). */
export interface AdmissionConvertResult {
  parentId: string;
  studentId: string;
  enrollmentId?: string | null;
  /** true nếu CLB phát hiện bản ghi đã tồn tại và tái dùng (idempotent). */
  reused?: boolean;
}

/**
 * Chốt lead → tạo Phụ huynh + Học viên + Ghi danh trong CLB.
 * Trả null nếu CLB offline hoặc handoff thất bại (caller giữ Deal ở trạng thái
 * chờ để thử lại — KHÔNG đánh dấu đã đồng bộ).
 */
export async function convertAdmission(
  input: AdmissionConvertInput,
): Promise<AdmissionConvertResult | null> {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    console.warn(
      "[clb] INTERNAL_API_TOKEN chưa cấu hình — bỏ qua handoff chốt lead.",
    );
    return null;
  }
  return callModule("clb", "/api/internal/admissions/convert", {
    method: "POST",
    headers: { "x-internal-token": token },
    body: JSON.stringify(input),
  });
}

/** Header xác thực service-to-service cho các endpoint nội bộ CLB (null nếu chưa cấu hình token). */
function internalHeaders(): Record<string, string> | null {
  const token = process.env.INTERNAL_API_TOKEN;
  if (!token) {
    console.warn("[clb] INTERNAL_API_TOKEN chưa cấu hình — bỏ qua gọi nội bộ.");
    return null;
  }
  return { "x-internal-token": token };
}

/** Tra phụ huynh theo SĐT (đã chuẩn hóa) để khử trùng trước khi tạo. */
export async function findParentByPhone(
  phone: string,
): Promise<{ id: string; customerId?: string } | null> {
  if (!phone) return null;
  const headers = internalHeaders();
  if (!headers) return null;
  return callModule(
    "clb",
    `/api/internal/parents/by-phone/${encodeURIComponent(phone)}`,
    { headers },
  );
}

/** Bản tóm tắt học viên cho view 360° trên Contact (lớp đang học, số buổi tồn, lịch sử phí). */
export async function getStudentSummary(
  studentId: string,
): Promise<any | null> {
  if (!studentId) return null;
  const headers = internalHeaders();
  if (!headers) return null;
  return callModule(
    "clb",
    `/api/internal/students/${encodeURIComponent(studentId)}/summary`,
    { headers },
  );
}
