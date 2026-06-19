import { Logo } from '@ds/brand/logo';

/**
 * Biểu tượng thương hiệu ở header sidebar /admin
 * (slot `admin.components.graphics.Icon`).
 *
 * `variant="symbol"` = chỉ biểu tượng quân cờ (navy #2B3990 từ @ds/brand).
 */
export function AdminIcon() {
  return (
    <Logo
      variant="symbol"
      style={{ width: 28, height: 28, display: 'block' }}
    />
  );
}

export default AdminIcon;
