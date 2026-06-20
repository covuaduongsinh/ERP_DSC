import type { ReactNode } from 'react'
import { FloatingZalo } from './FloatingZalo'
import { SiteFooter } from './SiteFooter'
import { SiteHeader } from './SiteHeader'

type SiteShellProps = {
  children: ReactNode
}

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <FloatingZalo />
    </div>
  )
}
