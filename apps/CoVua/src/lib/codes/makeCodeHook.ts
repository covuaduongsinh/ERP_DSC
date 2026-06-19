/**
 * Factory hook `beforeChange` tự sinh mã định danh nghiệp vụ khi TẠO bản ghi.
 *
 * Mỗi collection khai một `CodeSpec` (tiền tố, mốc kỳ, cần cơ sở?, pad…). Hook:
 *  1. chỉ chạy khi `operation==='create'` và `data.code` chưa có (nhập tay/khôi
 *     phục từ migration vẫn giữ nguyên mã sẵn có).
 *  2. tính {CS} (nếu cần) + chuỗi kỳ → ghép thành `scope` (khóa counter, dùng
 *     NĂM ĐẦY ĐỦ) và phần kỳ hiển thị (YY / YYYYMM).
 *  3. nếu cần cơ sở mà thiếu → THROW lỗi tiếng Việt rõ ràng (không đoán bừa).
 *  4. cấp số atomic qua `nextSequence` → ráp `data.code`.
 *
 * Hook chạy KỂ CẢ dưới `overrideAccess:true` (importer/Server Action) — Payload
 * luôn chạy hook nghiệp vụ, nên mã tự sinh cho mọi đường tạo. Số được cấp trên
 * connection riêng commit ngay (xem `counters.ts`): create rollback → gap (OK).
 */
import type { CollectionBeforeChangeHook, PayloadRequest } from 'payload';
import { getCodeCounterPool, nextSequence } from './counters';
import { resolveBranchCode } from './resolveBranch';
import { formatCode, yy, yyyy, yyyymm } from './format';

/** Cách tính chuỗi kỳ (dùng cho cả scope key lẫn mã in). */
export type PeriodGranularity = 'year' | 'month' | 'none';

export type CodeSpec = {
  /** Tiền tố mã (vd 'HV', 'PT', 'PH'). */
  prefix: string;
  /** Số chữ số tối thiểu cho phần thứ tự (tràn → in thêm chữ số, không cắt). */
  pad: number;
  /** Độ mịn kỳ: 'year'→năm, 'month'→YYYYMM, 'none'→không có phần kỳ. */
  period: PeriodGranularity;
  /**
   * Số chữ số NĂM in trong mã khi `period==='year'`: 2 (YY, mặc định) hoặc 4
   * (YYYY — vd Events `GIAI-2026-NN`). KHÔNG ảnh hưởng scope key: scope LUÔN dùng
   * năm đầy đủ 4 chữ số để tránh nhập nhằng (xem dưới).
   */
  yearDigits?: 2 | 4;
  /** Tên field mốc kỳ (vd 'ngayNop'); fallback `createdAt`/now nếu rỗng. */
  dateField?: string;
  /** Có cần mã cơ sở {CS} không (Payments/Refunds: true; Students: false). */
  needsBranch: boolean;
  /** Tên field select cơ sở (vd 'coSo') — chỉ dùng khi needsBranch. */
  coSoField?: string;
  /**
   * Tên field quan hệ `location` (vd 'location') — chỉ dùng khi needsBranch và
   * cơ sở suy từ `Locations.code` (Classes). Loại trừ với `coSoField`.
   */
  locationField?: string;
};

/** Lấy giá trị mốc kỳ: field nghiệp vụ → createdAt → now (luôn có giá trị). */
function resolvePeriodDate(
  data: Record<string, unknown>,
  spec: CodeSpec,
): unknown {
  if (spec.dateField && data[spec.dateField] != null) return data[spec.dateField];
  if (data.createdAt != null) return data.createdAt;
  return new Date();
}

/**
 * Tạo hook beforeChange cho một collection theo `spec`.
 */
export function makeCodeHook(spec: CodeSpec): CollectionBeforeChangeHook {
  return async ({ data, operation, req }) => {
    if (operation !== 'create') return data;
    if (!data) return data;
    if (data.code) return data; // giữ mã đã có (migration/khôi phục)

    const periodValue = resolvePeriodDate(data, spec);

    // ── Mã cơ sở {CS} ──────────────────────────────────────────────────────
    let branch: string | null = null;
    if (spec.needsBranch) {
      branch = await resolveBranchCode(req as PayloadRequest, {
        coSo: spec.coSoField ? data[spec.coSoField] : undefined,
        locationId: spec.locationField ? data[spec.locationField] : undefined,
      });
      if (!branch) {
        throw new Error(
          `Thiếu cơ sở để sinh mã ${spec.prefix}. Vui lòng chọn cơ sở (Kim Liên / Vĩnh Phúc) trước khi lưu.`,
        );
      }
    }

    // ── Phần kỳ: scope dùng năm ĐẦY ĐỦ; mã in dùng YY ───────────────────────
    let scopePeriod: string | null = null;
    let displayPeriod: string | null = null;
    if (spec.period === 'year') {
      scopePeriod = yyyy(periodValue); // scope LUÔN năm đầy đủ
      displayPeriod = spec.yearDigits === 4 ? yyyy(periodValue) : yy(periodValue);
    } else if (spec.period === 'month') {
      scopePeriod = yyyymm(periodValue);
      displayPeriod = scopePeriod; // tháng đã là YYYYMM ở cả hai
    }
    if (spec.period !== 'none' && !scopePeriod) {
      throw new Error(`Không xác định được kỳ để sinh mã ${spec.prefix}.`);
    }

    // ── Scope key: PREFIX[:CS][:period] ─────────────────────────────────────
    const scope = [spec.prefix, branch, scopePeriod]
      .filter((p): p is string => !!p)
      .join(':');

    const pool = getCodeCounterPool(req.payload);
    const seq = await nextSequence(pool, scope);

    data.code = formatCode(spec.prefix, [branch, displayPeriod], seq, spec.pad);
    return data;
  };
}
