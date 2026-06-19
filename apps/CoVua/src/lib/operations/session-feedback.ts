import 'server-only';
import type { Payload, Where } from 'payload';
import type {
  Attendance,
  Class,
  ClassSession,
  Coach,
  Location,
  Student,
  User,
} from '@/payload-types';
import { TRACK_LABEL, type TrackName } from '@/lib/roadmap';

/**
 * "NHẬN XÉT BUỔI HỌC" — đọc lịch sử nhận xét từng buổi của học viên cho 2 chiều xem:
 *
 *  1) Theo BUỔI DẠY  : gom các bản ghi `attendance` thành "buổi" → xem nhận xét tất
 *     cả HV trong một buổi.
 *  2) Theo HỌC VIÊN  : dòng thời gian nhận xét của một HV qua các buổi.
 *
 * Nguồn dữ liệu: collection `attendance` (per-HV: nhanXet/yThuc/lamBTVN/linkLichess;
 * nội dung buổi: kienThucMoi/giaoBTVN/khBuoiSau/sachDangHoc; định danh buổi: date/buoi/
 * coach/lop/session). KHÔNG đổi schema.
 *
 * BẤT ĐỐI XỨNG CŨ/MỚI: bản ghi lịch sử (import) lưu nội dung buổi NGAY trên attendance
 * và đa số chưa gắn `lop`/`session`; bản ghi mới (màn Buổi học) lưu nội dung buổi trên
 * `class-sessions`. Khi hiển thị → coalesce `attendance.* ?? session.*`.
 *
 * BẢO MẬT 🔒: mọi truy vấn `overrideAccess:false` + `user` ⇒ access control của
 * `attendance` (`withBranchScope(..., 'student.location')`) là hàng rào thật
 * (branch-scope theo cơ sở). `disableErrors:true` để find trả rỗng thay vì throw.
 */

export type AttendanceStatus = 'co_mat' | 'vang' | 'phep';

const VALID_STATUSES: AttendanceStatus[] = ['co_mat', 'vang', 'phep'];

/** Mốc ngày UTC 'YYYY-MM-DD' (so sánh chuỗi = so sánh thời gian). */
function utcDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function utcDayBounds(date: string): { start: Date; end: Date } | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function statusOrNull(v: unknown): AttendanceStatus | null {
  return typeof v === 'string' && VALID_STATUSES.includes(v as AttendanceStatus)
    ? (v as AttendanceStatus)
    : null;
}

function resolveLocationName(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const v = value as { name?: unknown };
    return typeof v.name === 'string' ? v.name : null;
  }
  return null;
}

/** Mã thứ theo ngày UTC ('YYYY-MM-DD'). getUTCDay: 0=CN..6=T7. */
const WEEKDAY_CODES = ['cn', 't2', 't3', 't4', 't5', 't6', 't7'] as const;
export function weekdayCode(dateKey: string | null): string | null {
  if (!dateKey) return null;
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return WEEKDAY_CODES[d.getUTCDay()] ?? null;
}

/**
 * Cơ sở suy theo THỨ — CHỈ dùng làm fallback khi buổi chưa có cơ sở thật.
 * Quy ước vận hành: T3/T5/T7 → Kim Liên; T2/T6 → Vĩnh Phúc; T4/CN → null.
 * Tên trả về khớp `locations.name` ('Kim Liên' / 'Vĩnh Phúc'). THUẦN.
 */
export function weekdayLocationName(dateKey: string | null): string | null {
  const code = weekdayCode(dateKey);
  if (code === 't3' || code === 't5' || code === 't7') return 'Kim Liên';
  if (code === 't2' || code === 't6') return 'Vĩnh Phúc';
  return null;
}

/** Nhãn tuyến (track hasMany của lớp) → mảng nhãn Việt, bỏ giá trị lạ. */
function trackLabels(track: unknown): string[] {
  if (!Array.isArray(track)) return [];
  return track
    .map((t) => (typeof t === 'string' ? (TRACK_LABEL[t as TrackName] ?? t) : null))
    .filter((s): s is string => s !== null && s !== '');
}

/** Tên hiển thị GV: ưu tiên `name` (công khai) → `hoTen` → `tenTat`. */
function resolveCoachName(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Partial<Coach>;
  return strOrNull(c.name) ?? strOrNull(c.hoTen) ?? strOrNull(c.tenTat);
}

function resolveStudentName(value: unknown, fallbackId: number | null): string {
  if (value && typeof value === 'object') {
    const s = value as Partial<Student>;
    const n = strOrNull(s.fullName);
    if (n) return n;
  }
  return fallbackId !== null ? `#${fallbackId}` : '—';
}

function resolveClassTitle(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const c = value as Partial<Class>;
    return strOrNull(c.title);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) GOM BUỔI (THUẦN — unit-test được, không I/O)
// ─────────────────────────────────────────────────────────────────────────────

export type SessionGroupKind = 'session' | 'buoi' | 'class-date' | 'coach-date';

/** Bản ghi attendance rút gọn (chỉ field cần để gom buổi). */
export interface AttendanceLite {
  id: number;
  student: number | null;
  date: string | null;
  buoi: string | null;
  lop: number | null;
  coach: number | null;
  session: number | null;
  nhanXet: string | null;
}

export interface SessionGroup {
  key: string;
  kind: SessionGroupKind;
  /** Mốc ngày UTC 'YYYY-MM-DD' (null nếu mọi bản ghi thiếu ngày). */
  date: string | null;
  sessionId: number | null;
  classId: number | null;
  buoi: string | null;
  coachId: number | null;
  studentCount: number;
  feedbackCount: number;
  attendanceIds: number[];
}

interface MutableGroup extends SessionGroup {
  _students: Set<number>;
}

/**
 * Gom `attendance` thành "buổi dạy" theo khóa ƯU TIÊN:
 *   session FK → mã buổi (`buoi`) → lớp+ngày → GV+ngày → chỉ-ngày (fallback cuối).
 *
 * Lý do thứ tự: dữ liệu MỚI luôn có `session`; dữ liệu LỊCH SỬ thường chỉ có mã
 * `buoi` (mỗi mã = một buổi, mỗi HV một bản ghi — theo khóa import co_so|buoi|ten).
 */
export function groupAttendanceIntoSessions(rows: AttendanceLite[]): SessionGroup[] {
  const groups = new Map<string, MutableGroup>();

  for (const r of rows) {
    const day = utcDayKey(r.date);
    const buoi = strOrNull(r.buoi);

    let key: string;
    let kind: SessionGroupKind;
    if (r.session !== null) {
      key = `s:${r.session}`;
      kind = 'session';
    } else if (buoi !== null) {
      key = `b:${buoi}`;
      kind = 'buoi';
    } else if (r.lop !== null && day !== null) {
      key = `cd:${r.lop}|${day}`;
      kind = 'class-date';
    } else if (r.coach !== null && day !== null) {
      key = `co:${r.coach}|${day}`;
      kind = 'coach-date';
    } else {
      key = `x:${day ?? 'unknown'}`;
      kind = 'coach-date';
    }

    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        kind,
        date: day,
        sessionId: r.session,
        classId: r.lop,
        buoi,
        coachId: r.coach,
        studentCount: 0,
        feedbackCount: 0,
        attendanceIds: [],
        _students: new Set<number>(),
      };
      groups.set(key, g);
    }

    g.attendanceIds.push(r.id);
    if (r.student !== null) g._students.add(r.student);
    if (strOrNull(r.nhanXet) !== null) g.feedbackCount += 1;
    // Bổ khuyết metadata nếu bản ghi đầu thiếu (vd ngày/GV/lớp ở bản ghi sau).
    if (g.date === null && day !== null) g.date = day;
    if (g.classId === null && r.lop !== null) g.classId = r.lop;
    if (g.coachId === null && r.coach !== null) g.coachId = r.coach;
    if (g.buoi === null && buoi !== null) g.buoi = buoi;
  }

  const out: SessionGroup[] = [];
  for (const g of groups.values()) {
    const { _students, ...rest } = g;
    out.push({ ...rest, studentCount: _students.size });
  }
  // Mới nhất trước; bản thiếu ngày xuống cuối.
  out.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) DANH SÁCH BUỔI (tab "Theo buổi dạy")
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionListRow {
  key: string;
  kind: SessionGroupKind;
  date: string | null;
  /** URL tới trang chi tiết buổi. */
  href: string;
  /** Nhãn buổi: tên lớp, hoặc "Mã buổi …". */
  label: string;
  location: string | null;
  /** GV hiệu lực: coachThucTe (class-session) ?? coach (attendance). */
  coachName: string | null;
  /** Id GV hiệu lực — để lọc theo giáo viên. */
  coachId: number | null;
  /** Trợ giảng thực tế (từ class-session) — để lọc + hiển thị. */
  troGiangName: string | null;
  troGiangId: number | null;
  studentCount: number;
  feedbackCount: number;
  /** Id `class-sessions` (≠ null ⇒ thao tác/sửa hàng loạt được). */
  sessionId: number | null;
  /** Id lớp đã gắn (từ attendance.lop hoặc session.lop). */
  classId: number | null;
  /** Nhãn tuyến suy từ lớp đã gắn (để lọc theo tuyến). */
  tuyen: string[];
  /** Mã thứ (t2..t7/cn) suy từ ngày — để lọc theo thứ. */
  thu: string | null;
}

function detailHref(g: SessionGroup): string {
  const base = '/admin/nhan-xet-buoi';
  if (g.kind === 'session' && g.sessionId !== null) return `${base}?session=${g.sessionId}`;
  if (g.kind === 'buoi' && g.buoi !== null) return `${base}?buoi=${encodeURIComponent(g.buoi)}`;
  if (g.kind === 'class-date' && g.classId !== null && g.date)
    return `${base}?class=${g.classId}&date=${g.date}`;
  if (g.kind === 'coach-date' && g.coachId !== null && g.date)
    return `${base}?coach=${g.coachId}&date=${g.date}`;
  // Fallback: lọc thô theo ngày trên list collection.
  return `${base}?date=${g.date ?? ''}`;
}

const LIST_COMMON = {
  overrideAccess: false as const,
  disableErrors: true as const,
  pagination: false as const,
  limit: 0,
};

/** Nạp danh sách buổi dạy (gom từ attendance, đính tên lớp/GV bằng find gộp). */
export async function loadSessionList(payload: Payload, user: User): Promise<SessionListRow[]> {
  const { docs } = await payload.find({
    collection: 'attendance',
    user,
    depth: 0,
    select: {
      student: true,
      date: true,
      buoi: true,
      lop: true,
      coach: true,
      session: true,
      nhanXet: true,
    },
    ...LIST_COMMON,
  });

  const lite: AttendanceLite[] = (docs as Attendance[]).map((a) => ({
    id: a.id,
    student: relId(a.student),
    date: typeof a.date === 'string' ? a.date : a.date ? new Date(a.date).toISOString() : null,
    buoi: strOrNull(a.buoi),
    lop: relId(a.lop),
    coach: relId(a.coach),
    session: relId(a.session),
    nhanXet: strOrNull(a.nhanXet),
  }));

  const groups = groupAttendanceIntoSessions(lite);

  // Tên lớp + GV qua find gộp (tránh N+1). Lớp cũng cho ra cơ sở + tuyến.
  const classIds = Array.from(new Set(groups.map((g) => g.classId).filter((v): v is number => v !== null)));
  const coachIds = Array.from(new Set(groups.map((g) => g.coachId).filter((v): v is number => v !== null)));
  const sessionIds = Array.from(new Set(groups.map((g) => g.sessionId).filter((v): v is number => v !== null)));

  const classMap = new Map<number, { title: string; location: string | null; tuyen: string[] }>();
  if (classIds.length > 0) {
    const { docs: classes } = await payload.find({
      collection: 'classes',
      where: { id: { in: classIds } },
      user,
      depth: 1,
      select: { title: true, location: true, track: true },
      ...LIST_COMMON,
    });
    for (const c of classes as Class[]) {
      classMap.set(c.id, {
        title: c.title,
        location: resolveLocationName(c.location as Location | number | null | undefined),
        tuyen: trackLabels(c.track),
      });
    }
  }

  // Buổi lịch sử có `lop = null` trên attendance nhưng cơ sở/lớp NẰM ở
  // `class-sessions` (đã gắn FK `session`). Đọc gộp để hiện cơ sở thật + lớp/tuyến.
  const sessionMap = new Map<
    number,
    {
      locationName: string | null;
      classId: number | null;
      classTitle: string | null;
      tuyen: string[];
      coachThucTeName: string | null;
      coachThucTeId: number | null;
      troGiangName: string | null;
      troGiangId: number | null;
    }
  >();
  if (sessionIds.length > 0) {
    const { docs: sessions } = await payload.find({
      collection: 'class-sessions',
      where: { id: { in: sessionIds } },
      user,
      depth: 1, // populate location/lop/coachThucTe/troGiangThucTe
      select: { location: true, lop: true, coachThucTe: true, troGiangThucTe: true },
      ...LIST_COMMON,
    });
    for (const s of sessions as ClassSession[]) {
      const lop = s.lop && typeof s.lop === 'object' ? (s.lop as Class) : null;
      sessionMap.set(s.id, {
        locationName: resolveLocationName(s.location as Location | number | null | undefined),
        classId: lop?.id ?? relId(s.lop),
        classTitle: lop ? strOrNull(lop.title) : null,
        tuyen: lop ? trackLabels(lop.track) : [],
        coachThucTeName: resolveCoachName(s.coachThucTe),
        coachThucTeId: relId(s.coachThucTe),
        troGiangName: resolveCoachName(s.troGiangThucTe),
        troGiangId: relId(s.troGiangThucTe),
      });
    }
  }

  const coachMap = new Map<number, string | null>();
  if (coachIds.length > 0) {
    const { docs: coaches } = await payload.find({
      collection: 'coaches',
      where: { id: { in: coachIds } },
      user,
      depth: 0,
      select: { name: true, hoTen: true, tenTat: true },
      ...LIST_COMMON,
    });
    for (const c of coaches as Coach[]) coachMap.set(c.id, resolveCoachName(c));
  }

  return groups.map((g) => {
    const cls = g.classId !== null ? classMap.get(g.classId) : undefined;
    const sInfo = g.sessionId !== null ? sessionMap.get(g.sessionId) : undefined;
    const classId = g.classId ?? sInfo?.classId ?? null;
    const classTitle = cls?.title ?? sInfo?.classTitle ?? null;
    const tuyen = cls?.tuyen?.length ? cls.tuyen : (sInfo?.tuyen ?? []);
    const label = classTitle
      ? classTitle
      : g.buoi
        ? `Mã buổi ${g.buoi}`
        : g.date
          ? `Buổi ngày ${g.date}`
          : 'Buổi (không rõ)';
    // GV hiệu lực: ưu tiên GV thực dạy (class-session) → GV trên điểm danh.
    const attCoachName = g.coachId !== null ? (coachMap.get(g.coachId) ?? null) : null;
    return {
      key: g.key,
      kind: g.kind,
      date: g.date,
      href: detailHref(g),
      label,
      // Cơ sở: ưu tiên lớp (đi-tới) → class-session (lịch sử) → suy theo thứ (fallback).
      location: cls?.location ?? sInfo?.locationName ?? weekdayLocationName(g.date),
      coachName: sInfo?.coachThucTeName ?? attCoachName,
      coachId: sInfo?.coachThucTeId ?? g.coachId,
      troGiangName: sInfo?.troGiangName ?? null,
      troGiangId: sInfo?.troGiangId ?? null,
      studentCount: g.studentCount,
      feedbackCount: g.feedbackCount,
      sessionId: g.sessionId,
      classId,
      tuyen,
      thu: weekdayCode(g.date),
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) CHI TIẾT MỘT BUỔI (xem nhận xét tất cả HV trong buổi)
// ─────────────────────────────────────────────────────────────────────────────

export type SessionFeedbackRef =
  | { sessionId: number }
  | { classId: number; date: string }
  | { coachId: number; date: string }
  | { buoi: string };

export interface SessionFeedbackRow {
  attendanceId: number;
  studentId: number | null;
  studentName: string;
  status: AttendanceStatus | null;
  yThuc: number | null;
  lamBTVN: number | null;
  nhanXet: string | null;
  linkLichess: string | null;
  /** Nội dung buổi NGAY trên bản ghi (chỉ dùng/ sửa khi buổi lịch sử). */
  kienThucMoi: string | null;
  giaoBTVN: string | null;
  khBuoiSau: string | null;
  sachDangHoc: string | null;
}

export interface SessionFeedbackData {
  title: string;
  date: string | null;
  location: string | null;
  coachName: string | null;
  classId: number | null;
  /** Id `class-sessions` nếu buổi gắn lớp (sửa nội dung buổi qua đây). */
  sessionId: number | null;
  /** Nội dung buổi cấp lớp (chỉ khi buổi gắn lớp). */
  classContent:
    | { mucTieu: string | null; kienThucMoi: string | null; giaoBTVN: string | null; khBuoiSau: string | null; sachDangHoc: string | null }
    | null;
  /** true ⇒ buổi lịch sử: nội dung buổi nằm trên từng bản ghi (sửa theo dòng). */
  isHistorical: boolean;
  rows: SessionFeedbackRow[];
}

function buildSessionWhere(ref: SessionFeedbackRef): Where | null {
  if ('sessionId' in ref) return { session: { equals: ref.sessionId } };
  if ('buoi' in ref) return { buoi: { equals: ref.buoi } };
  if ('classId' in ref) {
    const b = utcDayBounds(ref.date);
    if (!b) return null;
    return {
      and: [
        { lop: { equals: ref.classId } },
        { date: { greater_than_equal: b.start.toISOString() } },
        { date: { less_than_equal: b.end.toISOString() } },
      ],
    };
  }
  const b = utcDayBounds(ref.date);
  if (!b) return null;
  return {
    and: [
      { coach: { equals: ref.coachId } },
      { date: { greater_than_equal: b.start.toISOString() } },
      { date: { less_than_equal: b.end.toISOString() } },
    ],
  };
}

/** Chi tiết một buổi: per-HV rows + nội dung buổi (class-linked hoặc lịch sử). */
export async function loadSessionFeedback(
  payload: Payload,
  user: User,
  ref: SessionFeedbackRef,
): Promise<SessionFeedbackData | null> {
  const where = buildSessionWhere(ref);
  if (!where) return null;

  const { docs } = await payload.find({
    collection: 'attendance',
    where,
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1, // populate student / coach / lop / session
    pagination: false,
    limit: 0,
    sort: 'date',
  });

  const attendance = docs as Attendance[];
  if (attendance.length === 0) return null;

  const rows: SessionFeedbackRow[] = attendance.map((a) => ({
    attendanceId: a.id,
    studentId: relId(a.student),
    studentName: resolveStudentName(a.student, relId(a.student)),
    status: statusOrNull(a.status),
    yThuc: numOrNull(a.yThuc),
    lamBTVN: numOrNull(a.lamBTVN),
    nhanXet: strOrNull(a.nhanXet),
    linkLichess: strOrNull(a.linkLichess),
    kienThucMoi: strOrNull(a.kienThucMoi),
    giaoBTVN: strOrNull(a.giaoBTVN),
    khBuoiSau: strOrNull(a.khBuoiSau),
    sachDangHoc: strOrNull(a.sachDangHoc),
  }));
  rows.sort((a, b) => a.studentName.localeCompare(b.studentName, 'vi'));

  // Lấy class-session (nếu có) từ bản ghi đầu có `session` populate.
  let session: ClassSession | null = null;
  for (const a of attendance) {
    if (a.session && typeof a.session === 'object') {
      session = a.session as ClassSession;
      break;
    }
  }

  // Lớp + cơ sở + GV: ưu tiên class-session, sau đó bản ghi attendance.
  const firstWithClass = attendance.find((a) => a.lop && typeof a.lop === 'object');
  const classDoc =
    (session?.lop && typeof session.lop === 'object' ? (session.lop as Class) : null) ??
    (firstWithClass?.lop && typeof firstWithClass.lop === 'object' ? (firstWithClass.lop as Class) : null);
  const classId = classDoc?.id ?? relId(session?.lop) ?? relId(firstWithClass?.lop) ?? null;

  const firstWithCoach = attendance.find((a) => a.coach && typeof a.coach === 'object');
  const coachName =
    resolveCoachName(session?.coachThucTe) ?? resolveCoachName(firstWithCoach?.coach) ?? null;

  const date =
    utcDayKey(session?.date) ?? utcDayKey(attendance[0]?.date) ?? null;

  const buoi = strOrNull(attendance[0]?.buoi) ?? strOrNull(session?.buoi);
  const isHistorical = session === null;

  const title = classDoc?.title
    ? classDoc.title
    : buoi
      ? `Mã buổi ${buoi}`
      : date
        ? `Buổi ngày ${date}`
        : 'Buổi học';

  const location =
    resolveLocationName(classDoc?.location as Location | number | null | undefined) ??
    resolveLocationName(session?.location as Location | number | null | undefined);

  const classContent = session
    ? {
        mucTieu: strOrNull(session.mucTieu),
        kienThucMoi: strOrNull(session.kienThucMoi),
        giaoBTVN: strOrNull(session.giaoBTVN),
        khBuoiSau: strOrNull(session.khBuoiSau),
        sachDangHoc: strOrNull(session.sachDangHoc),
      }
    : null;

  return {
    title,
    date,
    location,
    coachName,
    classId,
    sessionId: session?.id ?? null,
    classContent,
    isHistorical,
    rows,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) DANH SÁCH HỌC VIÊN (tab "Theo học viên")
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFeedbackListRow {
  studentId: number;
  studentName: string;
  location: string | null;
  sessionCount: number;
  feedbackCount: number;
  lastDate: string | null;
}

/** Danh sách HV (đã có điểm danh) kèm số buổi + số nhận xét + ngày gần nhất. */
export async function loadStudentFeedbackList(
  payload: Payload,
  user: User,
): Promise<StudentFeedbackListRow[]> {
  const { docs } = await payload.find({
    collection: 'attendance',
    user,
    depth: 0,
    select: { student: true, date: true, nhanXet: true },
    ...LIST_COMMON,
  });

  const agg = new Map<number, { sessionCount: number; feedbackCount: number; lastDate: string | null }>();
  for (const a of docs as Attendance[]) {
    const sid = relId(a.student);
    if (sid === null) continue;
    const day = utcDayKey(a.date);
    const cur = agg.get(sid) ?? { sessionCount: 0, feedbackCount: 0, lastDate: null };
    cur.sessionCount += 1;
    if (strOrNull(a.nhanXet) !== null) cur.feedbackCount += 1;
    if (day !== null && (cur.lastDate === null || day > cur.lastDate)) cur.lastDate = day;
    agg.set(sid, cur);
  }

  const ids = Array.from(agg.keys());
  if (ids.length === 0) return [];

  const nameMap = new Map<number, { name: string; location: string | null }>();
  const { docs: students } = await payload.find({
    collection: 'students',
    where: { id: { in: ids } },
    user,
    depth: 1,
    select: { fullName: true, location: true },
    ...LIST_COMMON,
  });
  for (const s of students as Student[]) {
    nameMap.set(s.id, {
      name: strOrNull(s.fullName) ?? `#${s.id}`,
      location: resolveLocationName(s.location as Location | number | null | undefined),
    });
  }

  const rows: StudentFeedbackListRow[] = [];
  for (const [sid, a] of agg) {
    const meta = nameMap.get(sid);
    if (!meta) continue; // HV ngoài phạm vi cơ sở (branch-scope đã loại ở find students)
    rows.push({
      studentId: sid,
      studentName: meta.name,
      location: meta.location,
      sessionCount: a.sessionCount,
      feedbackCount: a.feedbackCount,
      lastDate: a.lastDate,
    });
  }
  rows.sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? ''));
  return rows;
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) DÒNG THỜI GIAN MỘT HỌC VIÊN (xem tiến bộ)
// ─────────────────────────────────────────────────────────────────────────────

export interface StudentFeedbackEntry {
  attendanceId: number;
  date: string | null;
  status: AttendanceStatus | null;
  classId: number | null;
  classTitle: string | null;
  buoi: string | null;
  coachName: string | null;
  /** Id class-session (≠ null ⇒ buổi gắn lớp; nội dung buổi nằm trên class-session). */
  sessionId: number | null;
  yThuc: number | null;
  lamBTVN: number | null;
  nhanXet: string | null;
  linkLichess: string | null;
  /** Nội dung buổi (coalesce attendance ?? class-session). */
  kienThucMoi: string | null;
  giaoBTVN: string | null;
  khBuoiSau: string | null;
  sachDangHoc: string | null;
}

export interface StudentFeedbackTimeline {
  studentId: number;
  studentName: string;
  location: string | null;
  entries: StudentFeedbackEntry[];
}

/** Dòng thời gian nhận xét của một HV (mới nhất trước). null nếu ngoài quyền. */
export async function loadStudentFeedbackTimeline(
  payload: Payload,
  user: User,
  studentId: number,
): Promise<StudentFeedbackTimeline | null> {
  let student: Student | null = null;
  try {
    student = (await payload.findByID({
      collection: 'students',
      id: studentId,
      user,
      overrideAccess: false,
      disableErrors: true,
      depth: 1,
    })) as Student;
  } catch {
    return null;
  }
  if (!student) return null;

  const { docs } = await payload.find({
    collection: 'attendance',
    where: { student: { equals: studentId } },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1, // populate coach / lop / session
    pagination: false,
    limit: 0,
    sort: '-date',
  });

  const entries: StudentFeedbackEntry[] = (docs as Attendance[]).map((a) => {
    const session = a.session && typeof a.session === 'object' ? (a.session as ClassSession) : null;
    return {
      attendanceId: a.id,
      date: utcDayKey(a.date),
      status: statusOrNull(a.status),
      classId: relId(a.lop) ?? relId(session?.lop),
      classTitle: resolveClassTitle(a.lop) ?? resolveClassTitle(session?.lop),
      buoi: strOrNull(a.buoi) ?? strOrNull(session?.buoi),
      coachName: resolveCoachName(a.coach) ?? resolveCoachName(session?.coachThucTe),
      sessionId: session?.id ?? null,
      yThuc: numOrNull(a.yThuc),
      lamBTVN: numOrNull(a.lamBTVN),
      nhanXet: strOrNull(a.nhanXet),
      linkLichess: strOrNull(a.linkLichess),
      kienThucMoi: strOrNull(a.kienThucMoi) ?? strOrNull(session?.kienThucMoi),
      giaoBTVN: strOrNull(a.giaoBTVN) ?? strOrNull(session?.giaoBTVN),
      khBuoiSau: strOrNull(a.khBuoiSau) ?? strOrNull(session?.khBuoiSau),
      sachDangHoc: strOrNull(a.sachDangHoc) ?? strOrNull(session?.sachDangHoc),
    };
  });

  return {
    studentId: student.id,
    studentName: strOrNull(student.fullName) ?? `#${student.id}`,
    location: resolveLocationName(student.location as Location | number | null | undefined),
    entries,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6) SỬA NHẬN XÉT (ghi) — branch-scope qua access của collection
// ─────────────────────────────────────────────────────────────────────────────

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users';
}

/** Clamp ý thức về [1,10]; ngoài khoảng / không phải số ⇒ null. */
function clampYThuc(v: unknown): number | null {
  const n = numOrNull(v);
  if (n === null) return null;
  if (n < 1 || n > 10) return null;
  return n;
}

export interface AttendanceFeedbackPatch {
  status?: AttendanceStatus;
  note?: string | null;
  yThuc?: number | null;
  lamBTVN?: number | null;
  nhanXet?: string | null;
  linkLichess?: string | null;
  // Chỉ áp dụng cho bản ghi LỊCH SỬ (không gắn class-session):
  kienThucMoi?: string | null;
  giaoBTVN?: string | null;
  khBuoiSau?: string | null;
  sachDangHoc?: string | null;
}

export type FeedbackUpdateResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

const CONTENT_KEYS = ['kienThucMoi', 'giaoBTVN', 'khBuoiSau', 'sachDangHoc'] as const;

/**
 * Field nội dung buổi ở CẤP `class-sessions` (gồm `mucTieu` — V2). KHÁC
 * `CONTENT_KEYS`: `attendance` (buổi lịch sử) KHÔNG có cột `muc_tieu`, nên đường
 * ghi attendance vẫn dùng `CONTENT_KEYS`; chỉ `updateSessionContent` dùng list này.
 */
const SESSION_CONTENT_KEYS = ['mucTieu', ...CONTENT_KEYS] as const;

/**
 * Sửa per-HV trên một bản ghi `attendance`. Field nội dung buổi (kienThucMoi…) chỉ
 * được ghi khi bản ghi KHÔNG gắn `session` (buổi lịch sử) — tránh phân kỳ với
 * `class-sessions`. `overrideAccess:false` ⇒ branch-scope chặn sửa chéo cơ sở.
 */
export async function updateAttendanceFeedback(
  payload: Payload,
  actor: User | null,
  attendanceId: number,
  patch: AttendanceFeedbackPatch,
): Promise<FeedbackUpdateResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(attendanceId) || attendanceId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Bản ghi không hợp lệ.' };
  }

  const data: Record<string, unknown> = {};
  if ('status' in patch) {
    if (!patch.status || !VALID_STATUSES.includes(patch.status)) {
      return { ok: false, error: 'invalid_input', message: 'Trạng thái không hợp lệ.' };
    }
    data.status = patch.status;
  }
  if ('note' in patch) data.note = strOrNull(patch.note);
  if ('yThuc' in patch) data.yThuc = clampYThuc(patch.yThuc);
  if ('lamBTVN' in patch) data.lamBTVN = numOrNull(patch.lamBTVN);
  if ('nhanXet' in patch) data.nhanXet = strOrNull(patch.nhanXet);
  if ('linkLichess' in patch) data.linkLichess = strOrNull(patch.linkLichess);

  const wantsContent = CONTENT_KEYS.some((k) => k in patch);

  try {
    // Field nội dung buổi: chỉ ghi nếu bản ghi không gắn class-session.
    if (wantsContent) {
      const current = (await payload.findByID({
        collection: 'attendance',
        id: attendanceId,
        user: actor,
        overrideAccess: false,
        disableErrors: true,
        depth: 0,
      })) as Attendance | null;
      if (!current) {
        return { ok: false, error: 'forbidden', message: 'Không tìm thấy bản ghi (hoặc ngoài phạm vi cơ sở).' };
      }
      if (relId(current.session) === null) {
        for (const k of CONTENT_KEYS) if (k in patch) data[k] = strOrNull(patch[k]);
      }
    }

    if (Object.keys(data).length === 0) return { ok: true };

    await payload.update({
      collection: 'attendance',
      id: attendanceId,
      data,
      user: actor,
      overrideAccess: false,
    });
    return { ok: true };
  } catch (err) {
    console.error('[updateAttendanceFeedback] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không lưu được (có thể ngoài phạm vi cơ sở của bạn).' };
  }
}

export interface SessionContentPatch {
  mucTieu?: string | null;
  kienThucMoi?: string | null;
  giaoBTVN?: string | null;
  khBuoiSau?: string | null;
  sachDangHoc?: string | null;
}

/** Sửa nội dung buổi (cấp lớp) trên `class-sessions` — chỉ buổi gắn lớp. */
export async function updateSessionContent(
  payload: Payload,
  actor: User | null,
  sessionId: number,
  patch: SessionContentPatch,
): Promise<FeedbackUpdateResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Buổi không hợp lệ.' };
  }
  const data: Record<string, unknown> = {};
  for (const k of SESSION_CONTENT_KEYS) if (k in patch) data[k] = strOrNull(patch[k]);
  if (Object.keys(data).length === 0) return { ok: true };

  try {
    await payload.update({
      collection: 'class-sessions',
      id: sessionId,
      data,
      user: actor,
      overrideAccess: false,
    });
    return { ok: true };
  } catch (err) {
    console.error('[updateSessionContent] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không lưu được nội dung buổi.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7) OPTION PICKERS (cho bộ lọc + thanh thao tác hàng loạt)
// ─────────────────────────────────────────────────────────────────────────────

export interface LocationOption {
  id: number;
  name: string;
}

/** Danh sách cơ sở (locations.read public). Dùng cho bộ lọc + gán cơ sở. */
export async function loadLocationOptions(payload: Payload, user: User): Promise<LocationOption[]> {
  const { docs } = await payload.find({
    collection: 'locations',
    user,
    depth: 0,
    select: { name: true },
    ...LIST_COMMON,
    sort: 'name',
  });
  return (docs as Location[])
    .map((l) => ({ id: l.id, name: strOrNull(l.name) ?? `#${l.id}` }))
    .filter((o) => o.name !== '');
}

export interface CoachOption {
  id: number;
  name: string;
}

/** Danh sách GV (coaches.read public). Dùng cho gán GV thực dạy hàng loạt. */
export async function loadCoachOptions(payload: Payload, user: User): Promise<CoachOption[]> {
  const { docs } = await payload.find({
    collection: 'coaches',
    user,
    depth: 0,
    select: { name: true, hoTen: true, tenTat: true },
    ...LIST_COMMON,
    sort: 'tenTat',
  });
  return (docs as Coach[]).map((c) => ({ id: c.id, name: resolveCoachName(c) ?? `#${c.id}` }));
}
