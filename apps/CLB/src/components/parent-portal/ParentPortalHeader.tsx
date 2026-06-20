import { Logo } from '@ds/brand'
import { parentSignOut } from '@/app/actions/parentAuth'

type ParentPortalHeaderProps = {
  parentName: string
  subtitle?: string
}

export function ParentPortalHeader({
  parentName,
  subtitle = 'Cổng phụ huynh',
}: ParentPortalHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-primary/10 bg-[var(--ds-white)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Logo variant="symbol" className="h-9 w-9 shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-primary">{subtitle}</p>
            <p className="truncate text-xs text-[var(--ds-text-muted)]">Xin chào, {parentName}</p>
          </div>
        </div>
        <form action={parentSignOut}>
          <button
            type="submit"
            className="shrink-0 text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Đăng xuất
          </button>
        </form>
      </div>
    </header>
  )
}
