import type { Coach, Event, FeaturedBook, Post } from '@/payload-types'
import { getPieceForLevel, type ChessLevel } from '@/lib/roadmap'
import type { AgeGroup } from '@/lib/training'

// Một cấp đơn lẻ (`Class['level']` nay là mảng ⇒ gọi getLevelLabel cho từng phần tử).
export function getLevelLabel(level: ChessLevel | FeaturedBook['level']): string {
  return getPieceForLevel(level)
}

const ageGroupLabels: Record<AgeGroup, string> = {
  mam_non_4_6: 'Mầm non 4-6 tuổi',
  cap_1_cap_2: 'Cấp 1 - Cấp 2',
}

export function getAgeGroupLabel(ageGroup: AgeGroup): string {
  return ageGroupLabels[ageGroup]
}

const postCategoryLabels: Record<Post['category'], string> = {
  tin_tuc: 'Tin tức',
  kien_thuc_co_vua: 'Kiến thức cờ vua',
  su_kien: 'Sự kiện',
  hoat_dong: 'Hoạt động',
  khac: 'Khác',
}

export function getPostCategoryLabel(category: Post['category']): string {
  return postCategoryLabels[category]
}

export function formatTuition(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' đ'
}

export function formatDate(date: string, locale = 'vi'): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string, locale = 'vi'): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

const eventTypeLabels: Record<Event['type'], string> = {
  khai_giang: 'Khai giảng',
  giai_dau: 'Giải đấu',
  workshop: 'Workshop',
  su_kien_cong_dong: 'Sự kiện cộng đồng',
  khac: 'Khác',
}

export function getEventTypeLabel(type: Event['type']): string {
  return eventTypeLabels[type]
}

const coachRoleLabels: Record<NonNullable<Coach['vaiTro']>, string> = {
  gv: 'Huấn luyện viên',
  tro_giang: 'Trợ giảng',
  tap_su: 'Tập sự',
}

export function getCoachRoleLabel(role: Coach['vaiTro']): string {
  return role ? coachRoleLabels[role] : 'Huấn luyện viên'
}
