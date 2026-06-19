import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_classes_age_group_new" AS ENUM ('mam_non_4_6', 'cap_1_cap_2');

    ALTER TABLE "classes"
      ALTER COLUMN "age_group" TYPE "enum_classes_age_group_new"
      USING (
        CASE "age_group"::text
          WHEN 'mam_non_3_6' THEN 'mam_non_4_6'
          WHEN 'nhap_mon'    THEN 'cap_1_cap_2'
          WHEN 'nang_cao'    THEN 'cap_1_cap_2'
        END
      )::"enum_classes_age_group_new";

    DROP TYPE "enum_classes_age_group";
    ALTER TYPE "enum_classes_age_group_new" RENAME TO "enum_classes_age_group";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "enum_classes_age_group_old" AS ENUM ('mam_non_3_6', 'nhap_mon', 'nang_cao');

    ALTER TABLE "classes"
      ALTER COLUMN "age_group" TYPE "enum_classes_age_group_old"
      USING (
        CASE "age_group"::text
          WHEN 'mam_non_4_6' THEN 'mam_non_3_6'
          WHEN 'cap_1_cap_2' THEN 'nhap_mon'
        END
      )::"enum_classes_age_group_old";

    DROP TYPE "enum_classes_age_group";
    ALTER TYPE "enum_classes_age_group_old" RENAME TO "enum_classes_age_group";
  `)
}
