import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Users.role → thêm giá trị enum `assistant` (Trợ giảng).
 *
 * `users.role` là native Postgres enum `enum_users_role` (xem
 * 20260602_160000_add_users_role). `ALTER TYPE … ADD VALUE` KHÔNG chạy được trong
 * transaction block (payload migrate bọc txn), nên dùng PATTERN SWAP của repo
 * (giống 20260527_age_group_v2): tạo type mới đủ giá trị, đổi kiểu cột, drop type
 * cũ, rename. Cột có DEFAULT 'receptionist' ⇒ DROP DEFAULT trước khi đổi kiểu,
 * SET DEFAULT lại sau khi rename.
 *
 * Quyền của assistant = NGANG coach (nhân viên khoá-cơ-sở): thừa access staffOnly
 * + branch-scope, bị loại khỏi mọi list hasRole đặc quyền bằng cách KHÔNG thêm vào.
 * ⇒ migration này CHỈ mở rộng enum, không đụng access.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_users_role_new" AS ENUM ('admin', 'manager', 'coach', 'accountant', 'receptionist', 'assistant');

    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "enum_users_role_new"
      USING ("role"::text)::"enum_users_role_new";

    DROP TYPE "enum_users_role";
    ALTER TYPE "enum_users_role_new" RENAME TO "enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'receptionist';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_users_role_old" AS ENUM ('admin', 'manager', 'coach', 'accountant', 'receptionist');

    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users"
      ALTER COLUMN "role" TYPE "enum_users_role_old"
      USING (
        CASE "role"::text
          WHEN 'assistant' THEN 'receptionist'
          ELSE "role"::text
        END
      )::"enum_users_role_old";

    DROP TYPE "enum_users_role";
    ALTER TYPE "enum_users_role_old" RENAME TO "enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'receptionist';
  `);
}
