import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Tạo bảng `users_sessions` cho auth sessions (DB-backed) của Payload 3.x.
 *
 * Bối cảnh sự cố: baseline 20260521_030933 CÓ `CREATE TABLE "users_sessions"`,
 * nhưng DB thực tế thiếu bảng này — nhiều khả năng DB gốc dựng bằng dev push
 * trên bản Payload cũ (chưa có tính năng sessions), sau đó mới đặt `push: false`;
 * baseline bị đánh dấu "đã chạy" trên các bảng có sẵn nên `CREATE TABLE
 * users_sessions` của baseline KHÔNG bao giờ thực thi. Hệ quả: MỌI truy vấn
 * collection `users` (gồm trang /admin/login, vì auth sessions left-join
 * users_sessions) lỗi `Failed query ... users_sessions` → admin panel KHÔNG
 * đăng nhập được.
 *
 * Migration additive idempotent (IF NOT EXISTS + DO/duplicate_object): tạo bảng
 * + FK + index NẾU chưa có; chạy lại an toàn. DDL khớp Y HỆT baseline để Drizzle
 * của Payload không phát hiện drift. Áp bằng `payload migrate` (KHÔNG push).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "users_sessions" (
    	"_order" integer NOT NULL,
    	"_parent_id" integer NOT NULL,
    	"id" varchar PRIMARY KEY NOT NULL,
    	"created_at" timestamp(3) with time zone,
    	"expires_at" timestamp(3) with time zone NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "users_sessions" CASCADE;
  `);
}
