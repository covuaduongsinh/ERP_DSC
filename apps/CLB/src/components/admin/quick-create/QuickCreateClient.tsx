'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, ChevronDown, type LucideIcon } from 'lucide-react'
import { QUICK_ACTIONS, type NavItemId } from '../nav/adminNavConfig'

export interface QuickCreateClientProps {
  /** Route id mà vai trò được THẤY (lọc lối tắt theo ROLE_NAV). */
  allowed: NavItemId[]
}

export function QuickCreateClient({ allowed }: QuickCreateClientProps) {
  const [open, setOpen] = useState(false)
  const allowedSet = new Set(allowed)
  const quick = QUICK_ACTIONS.filter((q) => !q.requires || allowedSet.has(q.requires))
  if (quick.length === 0) return null

  return (
    <div className="ds-qc">
      <button
        type="button"
        className="ds-qc-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="ds-qc-btn__ic" aria-hidden />
        Tạo nhanh
        <ChevronDown className="ds-qc-btn__caret" aria-hidden />
      </button>
      {open && (
        <>
          <div className="ds-qc__scrim" onClick={() => setOpen(false)} aria-hidden />
          <div className="ds-qc-menu" role="menu">
            <div className="ds-qc-menu__t">Tác vụ nhanh</div>
            {quick.map((q) => {
              const Icon: LucideIcon = q.icon
              return (
                <Link
                  key={q.href}
                  href={q.href}
                  className="ds-qc-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  <span className="ds-qc-item__ic">
                    <Icon className="ds-qc-item__glyph" aria-hidden />
                  </span>
                  {q.label}
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default QuickCreateClient
