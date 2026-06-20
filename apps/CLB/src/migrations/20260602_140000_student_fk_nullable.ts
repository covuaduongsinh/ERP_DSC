import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Cho phép xóa học viên mà GIỮ LẠI dữ liệu liên quan (orphan, student = NULL).
 *
 * Bối cảnh: 7 bảng con trỏ tới `students` đã có FK `ON DELETE SET NULL`, NHƯNG
 * cột `student_id` lại NOT NULL → xóa học viên làm Postgres set student_id=NULL
 * và vi phạm NOT NULL ("An unknown error has occurred" trên admin).
 *
 * Fix: BỎ ràng buộc NOT NULL ở 7 cột để SET NULL chạy được. Collection vẫn để
 * `required: true` (bắt buộc chọn học viên khi TẠO MỚI ở app-layer); chỉ DB cho
 * phép null khi học viên bị xóa → bản ghi cũ thành mồ côi nhưng còn lịch sử.
 */
const TABLES = [
  'progress_reports',
  'attendance',
  'enrollments',
  'student_levels',
  'tuition_cycles',
  'payments',
  'renewal_requests',
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of TABLES) {
    await db.execute(sql.raw(`ALTER TABLE "${t}" ALTER COLUMN "student_id" DROP NOT NULL;`))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Lưu ý: chỉ chạy được nếu KHÔNG còn bản ghi mồ côi (student_id IS NULL).
  for (const t of TABLES) {
    await db.execute(sql.raw(`ALTER TABLE "${t}" ALTER COLUMN "student_id" SET NOT NULL;`))
  }
}
