'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, ChevronsUpDown, Lock, Check } from 'lucide-react';
import { setAdminBranch } from '@/app/actions/setAdminBranch';
import { ADMIN_BRANCH_ALL } from '@/lib/admin-branch';

export interface BranchOption {
  id: number;
  name: string;
  short: string;
}

interface BranchSwitcherProps {
  /** Các cơ sở user chọn được (global = tất cả; khóa = chỉ cơ sở của mình). */
  options: BranchOption[];
  /** Bộ lọc đang áp: 'all' = mọi cơ sở; number[] = lọc IN (1 phần tử = 1 cơ sở cụ thể). */
  active: 'all' | number[];
  /** Có mở dropdown chọn được không (false ⇒ khóa cố định). */
  canChoose: boolean;
  /** Vai trò khóa-cơ-sở (hiển thị "cơ sở của bạn"). */
  locked: boolean;
  /** Nhãn mục "tất cả": 'Tất cả cơ sở' (global) | 'Tất cả cơ sở của bạn' (khóa). */
  allLabel: string;
}

/**
 * Bộ chọn cơ sở (multi). Global chọn 'Tất cả' hoặc 1 cơ sở bất kỳ. Vai trò khóa
 * nhiều cơ sở chọn 'Tất cả cơ sở của mình' hoặc 1 trong các cơ sở của mình
 * (KHÔNG ra ngoài — server `setAdminBranch` cũng chặn). Khóa 1 cơ sở / chưa gán ⇒
 * hiển thị cố định + icon khoá.
 */
export function BranchSwitcher({ options, active, canChoose, locked, allLabel }: BranchSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // active là 'all' hoặc mảng; mảng đúng 1 phần tử ⇒ 1 cơ sở cụ thể, còn lại ⇒ "tất cả".
  const isAll = active === 'all' || (Array.isArray(active) && active.length !== 1);
  const currentId = Array.isArray(active) && active.length === 1 ? active[0] : null;
  const currentName = isAll ? allLabel : (options.find((o) => o.id === currentId)?.name ?? allLabel);

  if (!canChoose) {
    const lockedName = options.length === 1 ? options[0].name : options.length === 0 ? 'Chưa gán cơ sở' : currentName;
    return (
      <div className="ds-side__loc">
        <div className="ds-locpick ds-locpick--locked" aria-disabled>
          <MapPin className="ds-locpick__ic" aria-hidden />
          <span className="ds-locpick__tx">
            <b>{lockedName}</b>
            <span>Khoá theo cơ sở của bạn</span>
          </span>
          <Lock className="ds-locpick__chev" aria-hidden />
        </div>
      </div>
    );
  }

  const choose = (value: string) => {
    setOpen(false);
    startTransition(async () => {
      await setAdminBranch(value);
      router.refresh();
    });
  };

  return (
    <div className="ds-side__loc" style={{ position: 'relative' }}>
      <button
        type="button"
        className="ds-locpick"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <MapPin className="ds-locpick__ic" aria-hidden />
        <span className="ds-locpick__tx">
          <b>{currentName}</b>
          <span>{locked ? 'Cơ sở của bạn' : isAll ? options.map((o) => o.name).join(' · ') : 'Đang lọc cơ sở này'}</span>
        </span>
        <ChevronsUpDown className="ds-locpick__chev" aria-hidden />
      </button>

      {open && (
        <>
          <div className="ds-locpick__scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="ds-locpick__menu" role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={isAll}
              className="ds-locpick__opt"
              onClick={() => choose(ADMIN_BRANCH_ALL)}
            >
              <span className="ds-locpick__badge ds-locpick__badge--all">ALL</span>
              <span className="ds-locpick__opttx">
                <b>{allLabel}</b>
                <span>{options.map((o) => o.name).join(' · ')}</span>
              </span>
              {isAll && <Check className="ds-locpick__check" aria-hidden />}
            </button>
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                role="option"
                aria-selected={currentId === o.id}
                className="ds-locpick__opt"
                onClick={() => choose(String(o.id))}
              >
                <span className="ds-locpick__badge">{o.short}</span>
                <span className="ds-locpick__opttx">
                  <b>{o.name}</b>
                </span>
                {currentId === o.id && <Check className="ds-locpick__check" aria-hidden />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default BranchSwitcher;
