'use client'

import type { DefaultCellComponentProps } from 'payload'

/**
 * Cell cho cột "Sĩ số hiện tại" trong list Lớp học: hiển thị con số sĩ số dưới
 * dạng link mở thẳng trang "Sĩ số lớp" với lớp đã chọn sẵn (`?class=ID`).
 * `cellData` = giá trị virtual field (đếm từ hook afterRead); `rowData.id` = id lớp.
 */
export function RosterLinkCell({ cellData, rowData }: DefaultCellComponentProps) {
  const id = (rowData as { id?: number })?.id
  const count = typeof cellData === 'number' ? cellData : 0
  if (typeof id !== 'number') return <span>{count}</span>
  return (
    <a href={`/admin/si-so-lop?class=${id}`} title="Xem danh sách học viên của lớp">
      {count} →
    </a>
  )
}

export default RosterLinkCell
