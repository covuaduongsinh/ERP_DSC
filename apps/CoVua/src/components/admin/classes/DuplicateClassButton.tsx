'use client'

import { Button, useSelection } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

/**
 * Nút "Tạo bản sao" trên list view Lớp học (đăng ký ở `beforeListTable`).
 *
 * Tick chọn lớp trong danh sách → bấm → POST /api/admin-duplicate/classes nhân
 * bản đầy đủ cấu hình (tên thêm "(bản sao)"). Tạo đúng 1 → mở luôn lớp mới để
 * sửa; tạo nhiều → refresh danh sách. Component chỉ render trong /admin nên chỉ
 * nhân viên thấy; endpoint vẫn tự kiểm tra quyền.
 */
export function DuplicateClassButton() {
  const { selectedIDs, count } = useSelection()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDuplicate = useCallback(async () => {
    if (busy || count === 0) return
    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/admin-duplicate/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ ids: selectedIDs }),
      })

      const json = (await response.json().catch(() => ({}))) as {
        error?: string
        created?: Array<{ id: number | string }>
      }

      if (!response.ok) {
        setError(json?.error ?? `Tạo bản sao thất bại (mã ${response.status}).`)
        return
      }

      const createdDocs = json.created ?? []
      if (createdDocs.length === 1) {
        // Mở bản sao ra để sửa ngay (đổi tên/lịch/GV…).
        router.push(`/admin/collections/classes/${createdDocs[0].id}`)
      } else {
        router.refresh()
      }
    } catch {
      setError('Không kết nối được máy chủ để tạo bản sao. Thử lại.')
    } finally {
      setBusy(false)
    }
  }, [busy, count, selectedIDs, router])

  return (
    <div className="ds-duplicate">
      <Button
        buttonStyle="secondary"
        size="small"
        type="button"
        disabled={busy || count === 0}
        onClick={handleDuplicate}
      >
        {busy
          ? 'Đang tạo bản sao…'
          : count > 0
            ? `Tạo bản sao (${count})`
            : 'Tạo bản sao'}
      </Button>
      <span className="ds-duplicate__hint">
        {count === 0
          ? 'Chọn lớp ở danh sách rồi bấm để nhân bản'
          : 'Nhân bản cấu hình lớp đã chọn (không gồm ghi danh/buổi học)'}
      </span>
      {error ? (
        <p className="ds-duplicate__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export default DuplicateClassButton
