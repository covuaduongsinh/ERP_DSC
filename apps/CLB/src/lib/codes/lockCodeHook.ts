/**
 * Hook `beforeValidate` KHÓA bất biến mã `code`: chặn mọi thay đổi mã sau khi
 * tạo, áp cho MỌI vai trò (kể cả admin). Sửa mã chỉ qua migration có kiểm soát.
 *
 * Đặt ở beforeValidate (chạy sớm, trước beforeChange) để báo lỗi tiếng Việt
 * thân thiện trước khi đụng DB. Field cũng đặt `admin.readOnly:true` để ẩn ô sửa
 * trên /admin — nhưng đó chỉ là UI; hook này mới là hàng rào thật (chặn cả PATCH
 * qua REST/GraphQL/Local API).
 *
 * Chỉ chặn khi `data.code` ĐƯỢC GỬI và KHÁC giá trị hiện tại — update field khác
 * (không gửi `code`) đi qua bình thường.
 */
import type { CollectionBeforeValidateHook } from 'payload'

export const lockCodeHook: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (operation !== 'update') return data
  if (!data) return data
  if (data.code === undefined) return data // không đụng tới code
  if (data.code === originalDoc?.code) return data // gửi nguyên giá trị cũ — OK

  throw new Error(
    'Mã định danh (code) là bất biến — không thể sửa sau khi tạo. Liên hệ quản trị nếu cần thay đổi.',
  )
}
