import { Logo } from '@ds/brand/logo'

/**
 * Logo thương hiệu trên màn ĐĂNG NHẬP /admin
 * (slot `admin.components.graphics.Logo`).
 *
 * Dùng SVG chính thức từ @ds/brand (navy #2B3990 — nguồn nhận diện DUY NHẤT,
 * không hardcode màu ở đây). `variant="full"` = biểu tượng + chữ + slogan.
 */
export function AdminLogo() {
  return <Logo variant="full" style={{ width: 200, height: 'auto', display: 'block' }} />
}

export default AdminLogo
