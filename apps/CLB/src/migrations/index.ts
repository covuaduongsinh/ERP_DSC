import * as migration_20260521_030933 from './20260521_030933'
import * as migration_20260524_add_media_prefix from './20260524_add_media_prefix'
import * as migration_20260527_age_group_v2 from './20260527_age_group_v2'
import * as migration_20260529_154027_add_renewal_requests from './20260529_154027_add_renewal_requests'
import * as migration_20260601_120000_add_coaches_hr_fields from './20260601_120000_add_coaches_hr_fields'
import * as migration_20260601_130000_add_attendance_session_fields from './20260601_130000_add_attendance_session_fields'
import * as migration_20260601_140000_add_levels_student_levels_enrollments from './20260601_140000_add_levels_student_levels_enrollments'
import * as migration_20260602_100000_progress_reports_eval_fields from './20260602_100000_progress_reports_eval_fields'
import * as migration_20260602_110000_add_students_nickname from './20260602_110000_add_students_nickname'
import * as migration_20260602_120000_add_payments from './20260602_120000_add_payments'
import * as migration_20260602_130000_add_coach_tentat_alias from './20260602_130000_add_coach_tentat_alias'
import * as migration_20260602_140000_student_fk_nullable from './20260602_140000_student_fk_nullable'
import * as migration_20260602_150000_add_import_logs from './20260602_150000_add_import_logs'
import * as migration_20260602_160000_add_users_role from './20260602_160000_add_users_role'
import * as migration_20260602_170000_add_users_sessions from './20260602_170000_add_users_sessions'
import * as migration_20260602_180000_add_rate_limits from './20260602_180000_add_rate_limits'
import * as migration_20260602_190000_add_books_book_issues from './20260602_190000_add_books_book_issues'
import * as migration_20260602_200000_add_leads_pipeline from './20260602_200000_add_leads_pipeline'
import * as migration_20260602_210000_add_audit_logs from './20260602_210000_add_audit_logs'
import * as migration_20260602_220000_add_users_location from './20260602_220000_add_users_location'
import * as migration_20260602_230000_add_finance_expenses from './20260602_230000_add_finance_expenses'
import * as migration_20260603_100000_progress_reports_unique_student_period from './20260603_100000_progress_reports_unique_student_period'
import * as migration_20260603_110000_add_students_opening_balance from './20260603_110000_add_students_opening_balance'
import * as migration_20260603_120000_add_user_role_assistant from './20260603_120000_add_user_role_assistant'
import * as migration_20260603_140000_users_role_location_hasmany from './20260603_140000_users_role_location_hasmany'
import * as migration_20260604_100000_add_class_coaches from './20260604_100000_add_class_coaches'
import * as migration_20260604_110000_add_class_schedule from './20260604_110000_add_class_schedule'
import * as migration_20260604_120000_add_expense_approval from './20260604_120000_add_expense_approval'
import * as migration_20260604_130000_add_refunds from './20260604_130000_add_refunds'
import * as migration_20260604_140000_add_coach_salary from './20260604_140000_add_coach_salary'
import * as migration_20260604_150000_add_tuition_packages from './20260604_150000_add_tuition_packages'
import * as migration_20260604_160000_add_class_sessions from './20260604_160000_add_class_sessions'
import * as migration_20260604_161000_add_attendance_session_fk from './20260604_161000_add_attendance_session_fk'
import * as migration_20260604_170000_class_sessions_buoi_location from './20260604_170000_class_sessions_buoi_location'
import * as migration_20260604_180000_import_logs_kind_class_enroll from './20260604_180000_import_logs_kind_class_enroll'
import * as migration_20260605_100000_add_web_content_collections from './20260605_100000_add_web_content_collections'
import * as migration_20260605_120000_add_leads_interested_class from './20260605_120000_add_leads_interested_class'
import * as migration_20260605_130000_classes_age_group_hasmany from './20260605_130000_classes_age_group_hasmany'
import * as migration_20260605_140000_classes_level_track_multiselect from './20260605_140000_classes_level_track_multiselect'
import * as migration_20260609_120000_import_logs_kind_session_planning from './20260609_120000_import_logs_kind_session_planning'
import * as migration_20260609_140000_add_session_student_plans from './20260609_140000_add_session_student_plans'
import * as migration_20260609_160000_add_curriculum_templates from './20260609_160000_add_curriculum_templates'
import * as migration_20260609_170000_import_logs_kind_curriculum_apply from './20260609_170000_import_logs_kind_curriculum_apply'
import * as migration_20260609_180000_add_holidays from './20260609_180000_add_holidays'
import * as migration_20260609_190000_holidays_location_hasmany from './20260609_190000_holidays_location_hasmany'
import * as migration_20260609_200000_add_code_counters from './20260609_200000_add_code_counters'
import * as migration_20260609_210000_students_payments_refunds_code from './20260609_210000_students_payments_refunds_code'
import * as migration_20260609_220000_phase2_codes from './20260609_220000_phase2_codes'
import * as migration_20260610_100000_phase3_codes_step1 from './20260610_100000_phase3_codes_step1'
import * as migration_20260610_110000_phase3_codes_step2 from './20260610_110000_phase3_codes_step2'

export const migrations = [
  {
    up: migration_20260521_030933.up,
    down: migration_20260521_030933.down,
    name: '20260521_030933',
  },
  {
    up: migration_20260524_add_media_prefix.up,
    down: migration_20260524_add_media_prefix.down,
    name: '20260524_add_media_prefix',
  },
  {
    up: migration_20260527_age_group_v2.up,
    down: migration_20260527_age_group_v2.down,
    name: '20260527_age_group_v2',
  },
  {
    up: migration_20260529_154027_add_renewal_requests.up,
    down: migration_20260529_154027_add_renewal_requests.down,
    name: '20260529_154027_add_renewal_requests',
  },
  {
    up: migration_20260601_120000_add_coaches_hr_fields.up,
    down: migration_20260601_120000_add_coaches_hr_fields.down,
    name: '20260601_120000_add_coaches_hr_fields',
  },
  {
    up: migration_20260601_130000_add_attendance_session_fields.up,
    down: migration_20260601_130000_add_attendance_session_fields.down,
    name: '20260601_130000_add_attendance_session_fields',
  },
  {
    up: migration_20260601_140000_add_levels_student_levels_enrollments.up,
    down: migration_20260601_140000_add_levels_student_levels_enrollments.down,
    name: '20260601_140000_add_levels_student_levels_enrollments',
  },
  {
    up: migration_20260602_100000_progress_reports_eval_fields.up,
    down: migration_20260602_100000_progress_reports_eval_fields.down,
    name: '20260602_100000_progress_reports_eval_fields',
  },
  {
    up: migration_20260602_110000_add_students_nickname.up,
    down: migration_20260602_110000_add_students_nickname.down,
    name: '20260602_110000_add_students_nickname',
  },
  {
    up: migration_20260602_120000_add_payments.up,
    down: migration_20260602_120000_add_payments.down,
    name: '20260602_120000_add_payments',
  },
  {
    up: migration_20260602_130000_add_coach_tentat_alias.up,
    down: migration_20260602_130000_add_coach_tentat_alias.down,
    name: '20260602_130000_add_coach_tentat_alias',
  },
  {
    up: migration_20260602_140000_student_fk_nullable.up,
    down: migration_20260602_140000_student_fk_nullable.down,
    name: '20260602_140000_student_fk_nullable',
  },
  {
    up: migration_20260602_150000_add_import_logs.up,
    down: migration_20260602_150000_add_import_logs.down,
    name: '20260602_150000_add_import_logs',
  },
  {
    up: migration_20260602_160000_add_users_role.up,
    down: migration_20260602_160000_add_users_role.down,
    name: '20260602_160000_add_users_role',
  },
  {
    up: migration_20260602_170000_add_users_sessions.up,
    down: migration_20260602_170000_add_users_sessions.down,
    name: '20260602_170000_add_users_sessions',
  },
  {
    up: migration_20260602_180000_add_rate_limits.up,
    down: migration_20260602_180000_add_rate_limits.down,
    name: '20260602_180000_add_rate_limits',
  },
  {
    up: migration_20260602_190000_add_books_book_issues.up,
    down: migration_20260602_190000_add_books_book_issues.down,
    name: '20260602_190000_add_books_book_issues',
  },
  {
    up: migration_20260602_200000_add_leads_pipeline.up,
    down: migration_20260602_200000_add_leads_pipeline.down,
    name: '20260602_200000_add_leads_pipeline',
  },
  {
    up: migration_20260602_210000_add_audit_logs.up,
    down: migration_20260602_210000_add_audit_logs.down,
    name: '20260602_210000_add_audit_logs',
  },
  {
    up: migration_20260602_220000_add_users_location.up,
    down: migration_20260602_220000_add_users_location.down,
    name: '20260602_220000_add_users_location',
  },
  {
    up: migration_20260602_230000_add_finance_expenses.up,
    down: migration_20260602_230000_add_finance_expenses.down,
    name: '20260602_230000_add_finance_expenses',
  },
  {
    up: migration_20260603_100000_progress_reports_unique_student_period.up,
    down: migration_20260603_100000_progress_reports_unique_student_period.down,
    name: '20260603_100000_progress_reports_unique_student_period',
  },
  {
    up: migration_20260603_110000_add_students_opening_balance.up,
    down: migration_20260603_110000_add_students_opening_balance.down,
    name: '20260603_110000_add_students_opening_balance',
  },
  {
    up: migration_20260603_120000_add_user_role_assistant.up,
    down: migration_20260603_120000_add_user_role_assistant.down,
    name: '20260603_120000_add_user_role_assistant',
  },
  {
    up: migration_20260603_140000_users_role_location_hasmany.up,
    down: migration_20260603_140000_users_role_location_hasmany.down,
    name: '20260603_140000_users_role_location_hasmany',
  },
  {
    up: migration_20260604_100000_add_class_coaches.up,
    down: migration_20260604_100000_add_class_coaches.down,
    name: '20260604_100000_add_class_coaches',
  },
  {
    up: migration_20260604_110000_add_class_schedule.up,
    down: migration_20260604_110000_add_class_schedule.down,
    name: '20260604_110000_add_class_schedule',
  },
  {
    up: migration_20260604_120000_add_expense_approval.up,
    down: migration_20260604_120000_add_expense_approval.down,
    name: '20260604_120000_add_expense_approval',
  },
  {
    up: migration_20260604_130000_add_refunds.up,
    down: migration_20260604_130000_add_refunds.down,
    name: '20260604_130000_add_refunds',
  },
  {
    up: migration_20260604_140000_add_coach_salary.up,
    down: migration_20260604_140000_add_coach_salary.down,
    name: '20260604_140000_add_coach_salary',
  },
  {
    up: migration_20260604_150000_add_tuition_packages.up,
    down: migration_20260604_150000_add_tuition_packages.down,
    name: '20260604_150000_add_tuition_packages',
  },
  {
    up: migration_20260604_160000_add_class_sessions.up,
    down: migration_20260604_160000_add_class_sessions.down,
    name: '20260604_160000_add_class_sessions',
  },
  {
    up: migration_20260604_161000_add_attendance_session_fk.up,
    down: migration_20260604_161000_add_attendance_session_fk.down,
    name: '20260604_161000_add_attendance_session_fk',
  },
  {
    up: migration_20260604_170000_class_sessions_buoi_location.up,
    down: migration_20260604_170000_class_sessions_buoi_location.down,
    name: '20260604_170000_class_sessions_buoi_location',
  },
  {
    up: migration_20260604_180000_import_logs_kind_class_enroll.up,
    down: migration_20260604_180000_import_logs_kind_class_enroll.down,
    name: '20260604_180000_import_logs_kind_class_enroll',
  },
  {
    up: migration_20260605_100000_add_web_content_collections.up,
    down: migration_20260605_100000_add_web_content_collections.down,
    name: '20260605_100000_add_web_content_collections',
  },
  {
    up: migration_20260605_120000_add_leads_interested_class.up,
    down: migration_20260605_120000_add_leads_interested_class.down,
    name: '20260605_120000_add_leads_interested_class',
  },
  {
    up: migration_20260605_130000_classes_age_group_hasmany.up,
    down: migration_20260605_130000_classes_age_group_hasmany.down,
    name: '20260605_130000_classes_age_group_hasmany',
  },
  {
    up: migration_20260605_140000_classes_level_track_multiselect.up,
    down: migration_20260605_140000_classes_level_track_multiselect.down,
    name: '20260605_140000_classes_level_track_multiselect',
  },
  {
    up: migration_20260609_120000_import_logs_kind_session_planning.up,
    down: migration_20260609_120000_import_logs_kind_session_planning.down,
    name: '20260609_120000_import_logs_kind_session_planning',
  },
  {
    up: migration_20260609_140000_add_session_student_plans.up,
    down: migration_20260609_140000_add_session_student_plans.down,
    name: '20260609_140000_add_session_student_plans',
  },
  {
    up: migration_20260609_160000_add_curriculum_templates.up,
    down: migration_20260609_160000_add_curriculum_templates.down,
    name: '20260609_160000_add_curriculum_templates',
  },
  {
    up: migration_20260609_170000_import_logs_kind_curriculum_apply.up,
    down: migration_20260609_170000_import_logs_kind_curriculum_apply.down,
    name: '20260609_170000_import_logs_kind_curriculum_apply',
  },
  {
    up: migration_20260609_180000_add_holidays.up,
    down: migration_20260609_180000_add_holidays.down,
    name: '20260609_180000_add_holidays',
  },
  {
    up: migration_20260609_190000_holidays_location_hasmany.up,
    down: migration_20260609_190000_holidays_location_hasmany.down,
    name: '20260609_190000_holidays_location_hasmany',
  },
  {
    up: migration_20260609_200000_add_code_counters.up,
    down: migration_20260609_200000_add_code_counters.down,
    name: '20260609_200000_add_code_counters',
  },
  {
    up: migration_20260609_210000_students_payments_refunds_code.up,
    down: migration_20260609_210000_students_payments_refunds_code.down,
    name: '20260609_210000_students_payments_refunds_code',
  },
  {
    up: migration_20260609_220000_phase2_codes.up,
    down: migration_20260609_220000_phase2_codes.down,
    name: '20260609_220000_phase2_codes',
  },
  {
    up: migration_20260610_100000_phase3_codes_step1.up,
    down: migration_20260610_100000_phase3_codes_step1.down,
    name: '20260610_100000_phase3_codes_step1',
  },
  {
    up: migration_20260610_110000_phase3_codes_step2.up,
    down: migration_20260610_110000_phase3_codes_step2.down,
    name: '20260610_110000_phase3_codes_step2',
  },
]
