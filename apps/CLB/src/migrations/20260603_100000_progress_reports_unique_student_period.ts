import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * ProgressReports → UNIQUE (student_id, period): mỗi học viên CHỈ một báo cáo mỗi
 * kỳ. Idempotency của importer đã bảo đảm điều này khi NHẬP FILE; index này chặn
 * tạo/sửa TAY trùng ở DB-level (defense-in-depth cùng hook `beforeValidate` trong
 * collections/ProgressReports.ts).
 *
 * ⚠️ TIỀN ĐỀ BẮT BUỘC: KHÔNG được còn cặp (student_id, period) trùng trước khi áp
 * — CREATE UNIQUE INDEX sẽ VỠ nếu còn trùng. Pre-check (chạy trên DB đích trước):
 *
 *   SELECT student_id, period, count(*) FROM progress_reports
 *   GROUP BY student_id, period HAVING count(*) > 1;
 *
 * Nếu có kết quả → dọn tay (đổi `period` hoặc xóa bản trùng) rồi mới migrate.
 * NULL `student_id` được Postgres coi là phân biệt (cho phép nhiều NULL) ⇒ không
 * ảnh hưởng.
 *
 * Additive, idempotent (IF NOT EXISTS). KHÔNG push; áp bằng `payload migrate` sau
 * khi review.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "progress_reports_student_period_idx"
      ON "progress_reports" USING btree ("student_id", "period");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "progress_reports_student_period_idx";
  `)
}
