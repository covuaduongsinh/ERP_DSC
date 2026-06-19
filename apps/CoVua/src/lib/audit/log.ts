import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  PayloadRequest,
} from 'payload';

/**
 * Audit log — ghi DIFF TỐI THIỂU cho các thao tác ghi nhạy cảm 🔒.
 *
 * Bảo mật (xem docs/security-access-control.md):
 *  - DÙNG ALLOWLIST từng collection (`AUDIT_CONFIG`). CHỈ field nằm trong danh
 *    sách mới được so sánh/ghi. Đây là phòng thủ chính để KHÔNG log secret/OTP:
 *    Users chỉ allow `email` + `role` ⇒ password/salt/hash/token KHÔNG BAO GIỜ
 *    lọt vào audit. OtpCodes hoàn toàn KHÔNG gắn hook.
 *  - Giá trị được `summarizeValue` nén lại: quan hệ/upload → chỉ giữ id; richText
 *    /json → cắt ngắn; chuỗi dài → cắt ngắn. Không dump cả bản ghi liên quan hay
 *    nội dung richText dài.
 *  - Ghi audit là BEST-EFFORT: viết ở transaction RIÊNG (không truyền `req`) +
 *    bọc try/catch ⇒ lỗi audit KHÔNG làm hỏng / không poison transaction nghiệp
 *    vụ (write Students/Payments/... vẫn thành công kể cả khi audit lỗi).
 */

export type AuditCollectionSlug =
  | 'students'
  | 'progress-reports'
  | 'payments'
  | 'expenses'
  | 'refunds'
  | 'users'
  | 'classes'
  | 'enrollments'
  | 'class-sessions'
  | 'session-student-plans'
  | 'curriculum-templates'
  | 'holidays';

type AuditFieldConfig = {
  /**
   * ALLOWLIST: chỉ các field này được so sánh và ghi vào diff. Bảo vệ secret
   * bằng cách KHÔNG đưa field nhạy cảm vào danh sách.
   */
  fields: string[];
};

const AUDIT_CONFIG: Record<AuditCollectionSlug, AuditFieldConfig> = {
  students: {
    fields: [
      'fullName',
      'nickname',
      'dob',
      'capChinh',
      'location',
      'parents',
      'enrollmentStatus',
      'note',
    ],
  },
  'progress-reports': {
    // richText (nhanXetChung, coachComment) CÓ trong allowlist để phát hiện sửa
    // nội dung, nhưng `summarizeValue` chỉ lưu bản nén — không dump cả nội dung.
    fields: [
      'student',
      'period',
      'level',
      'yThuc',
      'btvn',
      'thamGiaGiaiDau',
      'cacSachDaHoc',
      'nhanXetChung',
      'keHoach',
      'coachComment',
      'coach',
      'publishedAt',
    ],
  },
  payments: {
    fields: [
      'student',
      'ngayNop',
      'hocPhi',
      'tienSach',
      'muaKhac',
      'hp1Buoi',
      'soBuoiNop',
      'coSo',
      'tinhTrang',
      'anhBill',
      'tuitionCycle',
      'ghiChu',
    ],
  },
  expenses: {
    // Phiếu chi — tài chính, allowlist toàn bộ field nghiệp vụ (không secret).
    // Gồm field DUYỆT để truy vết ai duyệt/từ chối phiếu chi.
    fields: [
      'category',
      'amount',
      'spentAt',
      'coSo',
      'method',
      'payee',
      'attachment',
      'note',
      'trangThai',
      'duyetBoi',
      'lyDoTuChoi',
    ],
  },
  refunds: {
    // Hoàn tiền — tài chính (tiền ra), allowlist toàn bộ field nghiệp vụ.
    fields: ['student', 'soTien', 'ngayHoan', 'lyDo', 'coSo', 'phuongThuc', 'note'],
  },
  users: {
    // ALLOWLIST NGHIÊM NGẶT: KHÔNG BAO GIỜ log password/salt/hash/token. Chỉ
    // email + role + location (đủ để truy vết ai đổi quyền / đổi cơ sở của ai —
    // đổi cơ sở là đổi phạm vi truy cập, xem phân quyền theo cơ sở 🔒).
    fields: ['email', 'role', 'location'],
  },
  classes: {
    // Lớp học — truy vết đổi GV/lịch/sĩ số/trạng thái + Cấp/Tuyến (nay hasMany).
    // KHÔNG đưa `description` (richText) và `lichHoc` (array) vào để giữ diff gọn.
    fields: ['title', 'level', 'track', 'ageGroup', 'location', 'coach', 'troGiang', 'siSoToiDa', 'trangThai'],
  },
  enrollments: {
    // Ghi danh — truy vết thêm/rút/chuyển HV khỏi lớp.
    fields: ['student', 'class', 'ngayBatDau', 'ngayKetThuc', 'dangHoc'],
  },
  'class-sessions': {
    // Buổi học — truy vết đổi GV thực dạy/trạng thái (hủy/dạy bù) + nội dung buổi.
    fields: [
      'lop',
      'location',
      'buoi',
      'date',
      'coachThucTe',
      'troGiangThucTe',
      'trangThai',
      'buoiGoc',
      'mucTieu',
      'kienThucMoi',
      'giaoBTVN',
      'khBuoiSau',
      'sachDangHoc',
    ],
  },
  'session-student-plans': {
    // Kế hoạch buổi theo HV — truy vết sửa nội dung cá nhân hóa (override).
    fields: ['session', 'student', 'mucTieu', 'sachDangHoc', 'kienThucMoi', 'giaoBTVN', 'khBuoiSau'],
  },
  'curriculum-templates': {
    // Khung lộ trình — truy vết đổi metadata khung (không log từng bài để diff gọn;
    // `baiHoc` là array dài, summarizeValue sẽ nén nhưng vẫn cồng kềnh → bỏ ra ngoài).
    fields: ['tenKhung', 'capDo', 'tuyen', 'trangThai'],
  },
  holidays: {
    // Lịch nghỉ — truy vết ai thêm/sửa/tắt ngày nghỉ + phạm vi (toàn công ty/cơ sở).
    fields: ['tenNgayNghi', 'tuNgay', 'denNgay', 'location', 'kichHoat', 'ghiChu'],
  },
};

/** Ngưỡng cắt ngắn chuỗi/JSON khi lưu vào diff (chống dump nội dung dài). */
const MAX_VALUE_LEN = 200;

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '[unserializable]';
  }
}

function truncate(s: string): string {
  return s.length > MAX_VALUE_LEN ? `${s.slice(0, MAX_VALUE_LEN)}…` : s;
}

/**
 * Nén một giá trị field về dạng gọn, an toàn để lưu:
 *  - null/undefined → null
 *  - boolean/number → giữ nguyên
 *  - Date → ISO
 *  - string → cắt ngắn nếu dài
 *  - quan hệ/upload đã populate (`{ id, ... }`) → CHỈ giữ id
 *  - mảng → nén từng phần tử (mảng quan hệ → mảng id)
 *  - object khác (richText lexical / json) → JSON cắt ngắn
 */
export function summarizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  if (typeof v === 'string') return truncate(v);
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(summarizeValue);
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    if ('id' in obj && (typeof obj.id === 'number' || typeof obj.id === 'string')) {
      return obj.id;
    }
    return truncate(safeJson(obj));
  }
  return null;
}

/** So sánh hai giá trị field SAU KHI nén (quan hệ so theo id, chuỗi so bản cắt). */
function valueChanged(from: unknown, to: unknown): boolean {
  return safeJson(summarizeValue(from)) !== safeJson(summarizeValue(to));
}

type AuditActor = { user: number | null; actorLabel: string };

/**
 * Xác định chủ thể thao tác từ phiên. Chỉ nhân viên (collection `users`) mới gắn
 * vào FK `user`; phụ huynh/ẩn danh/hệ thống chỉ ghi nhãn text (không secret).
 */
function resolveActor(req: PayloadRequest | undefined): AuditActor {
  const u = req?.user as
    | { id?: number | string; collection?: string; email?: string; role?: string }
    | null
    | undefined;
  if (!u) return { user: null, actorLabel: 'system' };
  if (u.collection === 'users') {
    const label = u.email
      ? `${u.email}${u.role ? ` (${u.role})` : ''}`
      : `user:${u.id}`;
    return { user: typeof u.id === 'number' ? u.id : null, actorLabel: label };
  }
  if (u.collection === 'parents') {
    return { user: null, actorLabel: `parent:${u.id}` };
  }
  return { user: null, actorLabel: 'unknown' };
}

type AuditAction = 'create' | 'update' | 'delete';

type AuditRow = {
  action: AuditAction;
  collectionSlug: AuditCollectionSlug;
  documentId: string | null;
  user: number | null;
  actorLabel: string;
  diff: Record<string, unknown>;
};

/**
 * Ghi một bản ghi audit. CỐ Ý KHÔNG truyền `req` ⇒ chạy ở transaction riêng:
 * lỗi audit không poison transaction nghiệp vụ. Bọc try/catch ⇒ best-effort,
 * không bao giờ chặn thao tác gốc.
 */
async function writeAudit(
  req: PayloadRequest | undefined,
  row: AuditRow,
): Promise<void> {
  if (!req?.payload) return;
  try {
    await req.payload.create({
      collection: 'audit-logs',
      data: row,
      overrideAccess: true,
    });
  } catch (err) {
    req.payload.logger?.error?.({ err, msg: `audit-log write failed (${row.collectionSlug})` });
  }
}

const asRecord = (v: unknown): Record<string, unknown> =>
  (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Hook afterChange (create + update) → ghi diff các field allowlist đã đổi. */
export function auditAfterChange(
  slug: AuditCollectionSlug,
): CollectionAfterChangeHook {
  const { fields } = AUDIT_CONFIG[slug];
  return async ({ req, operation, doc, previousDoc }) => {
    const d = asRecord(doc);
    const prev = asRecord(previousDoc);
    const actor = resolveActor(req);
    const documentId = d.id != null ? String(d.id) : null;

    if (operation === 'create') {
      const changes: Record<string, { from: null; to: unknown }> = {};
      for (const f of fields) {
        const to = summarizeValue(d[f]);
        const isEmptyArray = Array.isArray(to) && to.length === 0;
        if (to !== null && !isEmptyArray) changes[f] = { from: null, to };
      }
      await writeAudit(req, {
        action: 'create',
        collectionSlug: slug,
        documentId,
        user: actor.user,
        actorLabel: actor.actorLabel,
        diff: { changes },
      });
      return doc;
    }

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    for (const f of fields) {
      if (valueChanged(prev[f], d[f])) {
        changes[f] = { from: summarizeValue(prev[f]), to: summarizeValue(d[f]) };
      }
    }
    // Không có field allowlist nào đổi ⇒ không ghi (tránh nhiễu audit).
    if (Object.keys(changes).length === 0) return doc;
    await writeAudit(req, {
      action: 'update',
      collectionSlug: slug,
      documentId,
      user: actor.user,
      actorLabel: actor.actorLabel,
      diff: { changes },
    });
    return doc;
  };
}

/** Hook afterDelete → ghi snapshot tối thiểu (field allowlist) của bản đã xóa. */
export function auditAfterDelete(
  slug: AuditCollectionSlug,
): CollectionAfterDeleteHook {
  const { fields } = AUDIT_CONFIG[slug];
  return async ({ req, id, doc }) => {
    const d = asRecord(doc);
    const actor = resolveActor(req);
    const documentId =
      id != null ? String(id) : d.id != null ? String(d.id) : null;

    const snapshot: Record<string, unknown> = {};
    for (const f of fields) {
      const val = summarizeValue(d[f]);
      if (val !== null) snapshot[f] = val;
    }
    await writeAudit(req, {
      action: 'delete',
      collectionSlug: slug,
      documentId,
      user: actor.user,
      actorLabel: actor.actorLabel,
      diff: { snapshot },
    });
    return doc;
  };
}

/**
 * Tiện ích gắn vào `hooks` của collection: trả về cặp afterChange/afterDelete.
 * Dùng: `hooks: buildAuditHooks('students')`.
 */
export function buildAuditHooks(slug: AuditCollectionSlug): {
  afterChange: CollectionAfterChangeHook[];
  afterDelete: CollectionAfterDeleteHook[];
} {
  return {
    afterChange: [auditAfterChange(slug)],
    afterDelete: [auditAfterDelete(slug)],
  };
}
