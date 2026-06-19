'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

/**
 * Nút "Quay lại" toàn cục trên topbar admin (đăng ký `admin.components.actions`).
 * Hiện khi URL có `?from=<đường-dẫn-nội-bộ>` — cho phép các trang đích (custom view
 * + trang sửa document gốc) có đường về đúng nơi vừa rời. `from_label` (tuỳ chọn)
 * cho nhãn rõ hơn, vd "Quay lại lớp học".
 *
 * 🔒 Chỉ điều hướng (UX). Chặn open-redirect: chỉ chấp nhận `from` nội bộ `/admin/...`.
 */

/** `from` an toàn: đường dẫn nội bộ admin, không phải URL tuyệt đối / protocol-relative. */
function isSafeInternal(from: string): boolean {
  return from.startsWith('/admin/') && !from.startsWith('//') && !from.includes('://');
}

function BackActionInner() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');
  if (!from || !isSafeInternal(from)) return null;

  const label = searchParams?.get('from_label');
  return (
    <Link href={from} className="ds-backaction" title="Quay lại nơi vừa rời">
      <ChevronLeft className="ds-backaction__ic" aria-hidden />
      {label ? `Quay lại ${label}` : 'Quay lại'}
    </Link>
  );
}

export function BackAction() {
  // useSearchParams() cần Suspense boundary để không ép cả cây sang CSR (Next 15).
  return (
    <Suspense fallback={null}>
      <BackActionInner />
    </Suspense>
  );
}

export default BackAction;
