import type { Class } from '@/payload-types'
import { levelOrder, type ChessLevel } from '@/lib/roadmap'

export { levelOrder }

/** Một nhóm tuổi đơn lẻ — tách khỏi `Class['ageGroup']` (nay là MẢNG hasMany). */
export type AgeGroup = NonNullable<Class['ageGroup']>[number]

export const ageGroupOrder: AgeGroup[] = ['mam_non_4_6', 'cap_1_cap_2']

export function groupClassesByLevel(classes: Class[]): Record<ChessLevel, Class[]> {
  const grouped = Object.fromEntries(levelOrder.map((level) => [level, [] as Class[]])) as Record<
    ChessLevel,
    Class[]
  >

  // Lớp có thể thuộc NHIỀU cấp (hasMany) ⇒ xuất hiện ở mỗi bucket cấp tương ứng.
  for (const classItem of classes) {
    for (const lv of classItem.level ?? []) {
      grouped[lv]?.push(classItem)
    }
  }

  return grouped
}

export function groupClassesByAgeGroup(classes: Class[]): Record<AgeGroup, Class[]> {
  const grouped = Object.fromEntries(
    ageGroupOrder.map((ageGroup) => [ageGroup, [] as Class[]]),
  ) as Record<AgeGroup, Class[]>

  // Lớp có thể thuộc NHIỀU nhóm tuổi (hasMany) ⇒ xuất hiện ở cả các bucket tương ứng.
  for (const classItem of classes) {
    for (const ag of classItem.ageGroup ?? []) {
      grouped[ag]?.push(classItem)
    }
  }

  return grouped
}
