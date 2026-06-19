import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import path from 'path';
import { buildConfig } from 'payload';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

import { Attendance } from './collections/Attendance';
import { AuditLogs } from './collections/AuditLogs';
import { BookIssues } from './collections/BookIssues';
import { Books } from './collections/Books';
import { Classes } from './collections/Classes';
import { ClassSessions } from './collections/ClassSessions';
import { SessionStudentPlans } from './collections/SessionStudentPlans';
import { CurriculumTemplates } from './collections/CurriculumTemplates';
import { Coaches } from './collections/Coaches';
import { Enrollments } from './collections/Enrollments';
import { Events } from './collections/Events';
import { ExpenseCategories } from './collections/ExpenseCategories';
import { Expenses } from './collections/Expenses';
import { FeaturedBooks } from './collections/FeaturedBooks';
import { Holidays } from './collections/Holidays';
import { ImportLogs } from './collections/ImportLogs';
import { Leads } from './collections/Leads';
import { Levels } from './collections/Levels';
import { Locations } from './collections/Locations';
import { Media } from './collections/Media';
import { OtpCodes } from './collections/OtpCodes';
import { Parents } from './collections/Parents';
import { Payments } from './collections/Payments';
import { Refunds } from './collections/Refunds';
import { StudentLevels } from './collections/StudentLevels';
import { Posts } from './collections/Posts';
import { ProgressReports } from './collections/ProgressReports';
import { Students } from './collections/Students';
import { RenewalRequests } from './collections/RenewalRequests';
import { TuitionCycles } from './collections/TuitionCycles';
import { TuitionPackages } from './collections/TuitionPackages';
import { Users } from './collections/Users';
import { WebCoaches } from './collections/WebCoaches';
import { WebLocations } from './collections/WebLocations';
import { WebPrograms } from './collections/WebPrograms';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const serverURL = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000';

export default buildConfig({
  serverURL,
  // Restrict cross-origin browser requests to the Payload REST/GraphQL API.
  // Only requests from the same origin (frontend + admin) are allowed.
  cors: [serverURL],
  // CSRF: accept same-origin requests only; prevents cross-site form attacks on admin.
  csrf: [serverURL],
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      // Logo + biểu tượng thương hiệu Dương Sinh (@ds/brand) cho màn đăng nhập
      // và header sidebar — thay logo mặc định Payload.
      graphics: {
        Logo: '/components/admin/branding/AdminLogo#AdminLogo',
        Icon: '/components/admin/branding/AdminIcon#AdminIcon',
      },
      // Sidebar tùy biến (navy, gom-nhóm, lọc theo role, badge hàng đợi, bộ chọn
      // cơ sở) — THAY TOÀN BỘ nav mặc định. Lối tắt "Tác vụ nhanh" gập vào đây
      // (trước ở beforeNavLinks). Gate quyền THẬT vẫn ở access/* (server-side).
      Nav: '/components/admin/nav/AdminNav#AdminNav',
      // Nút "＋ Tạo nhanh" trên topbar (header actions, góc phải toàn cục) — gập
      // "Tác vụ nhanh" cũ khỏi sidebar v2. Lọc lối tắt theo role (UX); gate THẬT
      // vẫn ở access/* trong từng view đích.
      actions: [
        // Nút "Quay lại" toàn cục (hiện khi URL có ?from=) — cho trang đích có
        // đường về đúng nơi vừa rời (custom view + trang sửa document gốc).
        '/components/admin/back-action/BackAction#BackAction',
        '/components/admin/quick-create/QuickCreateAction#QuickCreateAction',
      ],
      views: {
        // Bảng điều khiển tùy biến (role-aware): hàng đợi + KPI theo role + phễu +
        // lớp tại cơ sở. Thay dashboard mặc định; gập StaffQueuesPanel vào đây.
        dashboard: {
          Component: '/components/admin/dashboard/AdminDashboard#AdminDashboard',
        },
        // Lead pipeline kanban (kéo-thả đổi giai đoạn + drawer chuyển đổi).
        // Gate đọc = canManageLeads (admin/manager/receptionist) trong chính view.
        leadPipeline: {
          Component: '/components/admin/leads/LeadPipelineView#LeadPipelineView',
          path: '/lead-pipeline',
          exact: true,
        },
        paymentEntry: {
          Component: '/components/admin/payments/PaymentEntryView#PaymentEntryView',
          path: '/nhap-hoc-phi',
          exact: true,
        },
        publishProgressReports: {
          Component:
            '/components/admin/progress-reports/PublishQueueView#PublishQueueView',
          path: '/phat-hanh-bao-cao',
          exact: true,
        },
        renewalQueue: {
          Component:
            '/components/admin/renewals/RenewalQueueView#RenewalQueueView',
          path: '/duyet-gia-han',
          exact: true,
        },
        kpiReport: {
          Component: '/components/admin/kpi/KpiReportView#KpiReportView',
          path: '/bao-cao-kpi',
          exact: true,
        },
        teachingStats: {
          Component: '/components/admin/teaching/TeachingStatsView#TeachingStatsView',
          path: '/thong-ke-day',
          exact: true,
        },
        importStudents: {
          Component: '/components/admin/import/ImportViews#StudentsImportView',
          path: '/nhap-hoc-vien',
          exact: true,
        },
        importAttendance: {
          Component: '/components/admin/import/ImportViews#AttendanceImportView',
          path: '/nhap-diem-danh',
          exact: true,
        },
        importProgressReports: {
          Component: '/components/admin/import/ImportViews#ProgressReportsImportView',
          path: '/nhap-danh-gia',
          exact: true,
        },
        importCoaches: {
          Component: '/components/admin/import/ImportViews#CoachesImportView',
          path: '/nhap-giao-vien',
          exact: true,
        },
        importPayments: {
          Component: '/components/admin/import/ImportViews#PaymentsImportView',
          path: '/nhap-thanh-toan',
          exact: true,
        },
        importClasses: {
          Component: '/components/admin/import/ImportViews#ClassesImportView',
          path: '/nhap-lop',
          exact: true,
        },
        importEnrollments: {
          Component: '/components/admin/import/ImportViews#EnrollmentsImportView',
          path: '/nhap-ghi-danh',
          exact: true,
        },
        quickAttendance: {
          Component:
            '/components/admin/attendance/QuickAttendanceView#QuickAttendanceView',
          path: '/diem-danh-nhanh',
          exact: true,
        },
        buoiHoc: {
          Component: '/components/admin/buoi-hoc/BuoiHocView#BuoiHocView',
          path: '/buoi-hoc',
          exact: true,
        },
        sessionPlanning: {
          Component: '/components/admin/planning/SessionPlanningView#SessionPlanningView',
          path: '/lap-ke-hoach-lop',
          exact: true,
        },
        curriculumTemplates: {
          Component: '/components/admin/curriculum/CurriculumView#CurriculumView',
          path: '/soan-khung-lo-trinh',
          exact: true,
        },
        classRoster: {
          Component: '/components/admin/classes/ClassRosterView#ClassRosterView',
          path: '/si-so-lop',
          exact: true,
        },
        // Hồ sơ lớp học — route động /admin/lop/:id (id đọc từ params.segments).
        // Header + statstrip + 3 tab (HV/buổi/khung). Gate đọc qua access collection.
        classDetail: {
          Component: '/components/admin/classes/ClassDetailView#ClassDetailView',
          path: '/lop/:id',
        },
        studentEnrollment: {
          Component: '/components/admin/ghi-danh/StudentEnrollmentView#StudentEnrollmentView',
          path: '/ghi-danh-hoc-vien',
          exact: true,
        },
        timetable: {
          Component: '/components/admin/timetable/TimetableView#TimetableView',
          path: '/thoi-khoa-bieu',
          exact: true,
        },
        payroll: {
          Component: '/components/admin/payroll/PayrollView#PayrollView',
          path: '/bang-luong',
          exact: true,
        },
        tuitionDebt: {
          Component: '/components/admin/finance/TuitionDebtView#TuitionDebtView',
          path: '/cong-no',
          exact: true,
        },
        sessionBalance: {
          Component:
            '/components/admin/sessions/SessionBalanceView#SessionBalanceView',
          path: '/so-buoi-ton',
          exact: true,
        },
        sessionFeedback: {
          Component: '/components/admin/feedback/SessionFeedbackView#SessionFeedbackView',
          path: '/nhan-xet-buoi',
          exact: true,
        },
        dataHygiene: {
          Component: '/components/admin/hygiene/DataHygieneView#DataHygieneView',
          path: '/du-lieu-can-hoan-thien',
          exact: true,
        },
        // Ma trận phân quyền (tài liệu sống, đọc-only) — gate xem = isAdmin trong view.
        permissionMatrix: {
          Component: '/components/admin/system/PermissionMatrixView#PermissionMatrixView',
          path: '/phan-quyen',
          exact: true,
        },
      },
    },
  },
  // Thứ tự mảng = thứ tự NHÓM hiển thị trên nav/dashboard (Payload xếp nhóm theo
  // collection đầu tiên mang `admin.group` đó). Giữ theo luồng nghiệp vụ:
  // Tuyển sinh → Học viên/PH → Đào tạo → Tài chính → Sách → Nội dung web →
  // Cổng phụ huynh → Nhập liệu → Hệ thống.
  collections: [
    // — Tuyển sinh & CRM —
    Leads,
    // — Học viên & Phụ huynh (Giai đoạn 4) —
    Parents,
    Students,
    StudentLevels,
    Enrollments,
    // — Đào tạo —
    Levels,
    Classes,
    Coaches,
    Locations,
    Attendance,
    ClassSessions,
    SessionStudentPlans,
    CurriculumTemplates,
    Holidays,
    ProgressReports,
    // — Tài chính (THU: Payments/TuitionCycles · CHI: Expenses · HOÀN: Refunds) —
    Payments,
    TuitionCycles,
    TuitionPackages,
    ExpenseCategories,
    Expenses,
    Refunds,
    // — Sách (catalog nội bộ + phát sách, nhập từ Lark CRM — ngoài scope GĐ1) —
    Books,
    BookIssues,
    FeaturedBooks,
    // — Nội dung web —
    Posts,
    Events,
    Media,
    // — Nội dung website (curated, tách khỏi dữ liệu vận hành) —
    WebLocations,
    WebCoaches,
    WebPrograms,
    // — Cổng phụ huynh —
    RenewalRequests,
    // — Nhập liệu —
    ImportLogs,
    // — Hệ thống (Nhật ký kiểm toán: diff tối thiểu thao tác ghi nhạy cảm, admin đọc) —
    Users,
    AuditLogs,
    // Ẩn khỏi nav — mã OTP đăng nhập cổng phụ huynh
    OtpCodes,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      max: 3,
    },
    // Mac dinh TAT dev push: schema chi thay doi qua `payload migrate:create` + migrate.
    // Tranh tinh trang push hoi tuong tac giua enum cu/moi lam dev server treo
    // (xem GĐ4 schema sync 2026-05-29).
    // NGOAI LE: dat PAYLOAD_DB_PUSH=true de bootstrap schema DAY DU tu config tren DB
    // RONG (vd moi truong moi self-host trong ERP), vi chuoi migration lich su KHONG
    // dung du schema tu trong. Sau khi bootstrap xong nen tat lai (mac dinh false).
    push: process.env.PAYLOAD_DB_PUSH === 'true',
  }),
  sharp,
  plugins: [
    ...(process.env.S3_BUCKET && process.env.S3_ENDPOINT
      ? [
          s3Storage({
            collections: {
              media: {
                prefix: 'media',
                generateFileURL: ({ filename, prefix }) => {
                  const bucket = process.env.S3_BUCKET;
                  // MinIO / generic S3 (self-host): public path-style URL khi S3_PUBLIC_URL được set.
                  if (process.env.S3_PUBLIC_URL) {
                    return `${process.env.S3_PUBLIC_URL}/${bucket}/${prefix}/${filename}`;
                  }
                  // Supabase Storage (back-compat) — giữ nguyên hành vi cũ nếu chưa cấu hình MinIO.
                  return `${process.env.SUPABASE_PUBLIC_URL}/storage/v1/object/public/${bucket}/${prefix}/${filename}`;
                },
              },
            },
            bucket: process.env.S3_BUCKET,
            config: {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
              },
              region: process.env.S3_REGION || 'ap-southeast-1',
              endpoint: process.env.S3_ENDPOINT,
              forcePathStyle: true,
            },
          }),
        ]
      : []),
  ],
});
