/**
 * Kiểu chung cho luồng import Excel/CSV (Attendance + ProgressReports).
 *
 * Mọi đường dẫn nhập liệu đều trả `ImportResult` có cấu trúc cố định để UI
 * hiển thị báo cáo theo dòng (created / updated / skipped / errors). Lỗi
 * luôn kèm `row` (số dòng trong file, đã trừ header) để nhân viên mở Excel
 * sửa được ngay.
 */

/** Bản ghi đã chuẩn hóa: header → giá trị string (đã trim). */
export type NormalizedRow = Record<string, string>;

/**
 * Tùy chọn chung cho mọi importer. `dryRun: true` ⇒ CHẠY HẾT phần khớp + kiểm
 * tra hợp lệ NHƯNG KHÔNG ghi DB (dùng cho bước xem trước). Khi đó status
 * created/updated mang nghĩa "SẼ tạo / SẼ cập nhật".
 */
export type ImportOptions = { dryRun?: boolean };

export type RowOutcome =
  | {
      row: number;
      status: 'created';
      studentId: number;
      key: string;
      /** Nhãn người-đọc-được để hiển thị ở bảng xem trước (vd "An — 6 tháng cuối 2025"). */
      label?: string;
      /** File CÓ ghi HLV trong cột gv_phu_trach? */
      coachProvided?: boolean;
      /** Đã gắn được HLV (coach) qua tenTat? (cảnh báo mềm nếu có ghi mà false). */
      coachLinked?: boolean;
    }
  | {
      row: number;
      status: 'updated';
      studentId: number;
      key: string;
      label?: string;
      coachProvided?: boolean;
      coachLinked?: boolean;
    }
  | {
      // Trùng khóa với một dòng TRƯỚC trong cùng file → bỏ qua để dòng đầu là
      // nguồn sự thật (không nhân đôi, không ghi đè ngầm).
      row: number;
      status: 'skipped';
      key: string;
      label?: string;
      message: string;
    }
  | {
      row: number;
      status: 'error';
      message: string;
      /** Cột (header) gây lỗi, nếu xác định được. */
      field?: string;
    };

export type ImportResult = {
  fileName: string;
  totalRows: number;
  created: number;
  updated: number;
  /** Số dòng bỏ qua vì trùng khóa trong cùng file. */
  skipped: number;
  errors: number;
  outcomes: RowOutcome[];
};

/** Tạo ImportResult rỗng để các processor tích lũy. */
export function emptyResult(fileName: string): ImportResult {
  return {
    fileName,
    totalRows: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  };
}

export function recordOutcome(result: ImportResult, outcome: RowOutcome): void {
  result.outcomes.push(outcome);
  if (outcome.status === 'created') result.created += 1;
  else if (outcome.status === 'updated') result.updated += 1;
  else if (outcome.status === 'skipped') result.skipped += 1;
  else if (outcome.status === 'error') result.errors += 1;
}
