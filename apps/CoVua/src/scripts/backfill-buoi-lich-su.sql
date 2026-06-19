-- ============================================================================
-- Backfill BUỔI HỌC LỊCH SỬ → class_sessions (Phase 2, GĐ2)
--
-- Gom historical attendance (lop_id NULL, có `buoi`) theo (buoi, coach, date)
-- thành buổi học lịch sử (lop=null, có buoi/GV/cơ sở/ngày, trạng thái 'da_day'),
-- rồi liên kết attendance.session_id.
--
-- IDEMPOTENT: ON CONFLICT (khoa_buoi) DO NOTHING + UPDATE chỉ where session_id NULL.
-- Khóa buổi lịch sử: 'H|' || buoi || '|' || coalesce(coach_id,'0') || '|' || YYYY-MM-DD.
-- Cơ sở = mode(student.location) trong nhóm (đa số; null nếu trống).
--
-- CHẠY SAU migration 20260604_170000 (lop nullable + location + buoi).
-- Áp qua Supabase MCP apply_migration / execute_sql — KHÔNG push. (Đối soát dry-run trước.)
-- ============================================================================

-- 1) Tạo buổi học lịch sử
INSERT INTO "class_sessions" (
  "lop_id", "location_id", "buoi", "coach_thuc_te_id", "date", "thu",
  "trang_thai", "kien_thuc_moi", "giao_b_t_v_n", "kh_buoi_sau", "sach_dang_hoc",
  "khoa_buoi", "created_at", "updated_at"
)
SELECT
  NULL,
  mode() WITHIN GROUP (ORDER BY s.location_id)                              AS location_id,
  a.buoi,
  a.coach_id,
  (((a.date AT TIME ZONE 'UTC')::date)::timestamp) AT TIME ZONE 'UTC'       AS date,
  (CASE extract(dow FROM (a.date AT TIME ZONE 'UTC')::date)
     WHEN 1 THEN 't2' WHEN 2 THEN 't3' WHEN 3 THEN 't4' WHEN 4 THEN 't5'
     WHEN 5 THEN 't6' WHEN 6 THEN 't7' WHEN 0 THEN 'cn'
   END)::"enum_class_sessions_thu"                                          AS thu,
  'da_day'::"enum_class_sessions_trang_thai",
  max(a.kien_thuc_moi), max(a.giao_b_t_v_n), max(a.kh_buoi_sau), max(a.sach_dang_hoc),
  'H|' || a.buoi || '|' || coalesce(a.coach_id::text, '0') || '|'
        || to_char((a.date AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')         AS khoa_buoi,
  now(), now()
FROM "attendance" a
LEFT JOIN "students" s ON s.id = a.student_id
WHERE a.buoi IS NOT NULL
GROUP BY a.buoi, a.coach_id, (a.date AT TIME ZONE 'UTC')::date
ON CONFLICT ("khoa_buoi") DO NOTHING;

-- 2) Liên kết attendance → buổi học
UPDATE "attendance" a
SET "session_id" = cs.id
FROM "class_sessions" cs
WHERE cs."khoa_buoi" = 'H|' || a.buoi || '|' || coalesce(a.coach_id::text, '0') || '|'
        || to_char((a.date AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD')
  AND a.buoi IS NOT NULL
  AND a."session_id" IS NULL;
