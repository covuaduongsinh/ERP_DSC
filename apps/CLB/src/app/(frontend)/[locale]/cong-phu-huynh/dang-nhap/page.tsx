import { redirect } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getCurrentParent } from '@/lib/parent-auth'
import { ParentLoginForm } from './ParentLoginForm'

type Props = {
  params: Promise<{ locale: string }>
}

export const dynamic = 'force-dynamic'

export default async function ParentLoginPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const parent = await getCurrentParent()
  if (parent) {
    redirect('/cong-phu-huynh')
  }

  return (
    <section className="bg-[var(--ds-bg)] py-12">
      <div className="mx-auto max-w-md px-4">
        <h1 className="mb-2 text-center text-2xl font-bold text-primary">Cổng phụ huynh</h1>
        <p className="mb-6 text-center text-sm text-[var(--ds-text-muted)]">
          Đăng nhập bằng số điện thoại đã đăng ký với trung tâm.
        </p>
        <ParentLoginForm />
      </div>
    </section>
  )
}
