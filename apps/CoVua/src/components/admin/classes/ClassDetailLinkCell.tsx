'use client'

import type { DefaultCellComponentProps } from 'payload'

/**
 * Cell cho cột "Tên lớp" trong list Lớp học: hiển thị tên lớp dưới dạng link mở
 * trang Hồ sơ lớp học (`/admin/lop/:id`). `cellData` = title; `rowData.id` = id lớp.
 */
export function ClassDetailLinkCell({ cellData, rowData }: DefaultCellComponentProps) {
  const id = (rowData as { id?: number })?.id
  const title = typeof cellData === 'string' ? cellData : ''
  if (typeof id !== 'number') return <span>{title}</span>
  return (
    <a href={`/admin/lop/${id}`} title="Mở hồ sơ lớp học">
      {title || `Lớp #${id}`}
    </a>
  )
}

export default ClassDetailLinkCell
