import Link from 'next/link'
import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import {
  loadSessionList,
  loadSessionFeedback,
  loadStudentFeedbackList,
  loadStudentFeedbackTimeline,
  loadLocationOptions,
  loadCoachOptions,
  type SessionFeedbackRef,
} from '@/lib/operations/session-feedback'
import { loadClassOptions } from '@/lib/operations/roster'
import { FeedbackBrowserClient } from './FeedbackBrowserClient'
import { SessionFeedbackTable } from './SessionFeedbackTable'
import { StudentFeedbackTimeline } from './StudentFeedbackTimeline'

/**
 * NHẬN XÉT BUỔI HỌC (admin view — staff tool). 2 chiều xem qua searchParams:
 *
 *  - `/admin/nhan-xet-buoi`                       → landing 2 tab (theo buổi / theo HV).
 *  - `/admin/nhan-xet-buoi?student=<id>`          → dòng thời gian nhận xét 1 HV.
 *  - `/admin/nhan-xet-buoi?session=<id>`          → 1 buổi (gắn lớp, theo class-session).
 *  - `/admin/nhan-xet-buoi?class=<id>&date=<d>`   → 1 buổi theo lớp + ngày.
 *  - `/admin/nhan-xet-buoi?coach=<id>&date=<d>`   → 1 buổi theo GV + ngày (fallback).
 *  - `/admin/nhan-xet-buoi?buoi=<code>`           → 1 buổi lịch sử theo mã buổi.
 *
 * Toàn cơ sở (branch-scope theo access HV/buổi). Xem `lib/operations/session-feedback.ts`.
 */

function firstParam(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function parseId(raw: string | string[] | undefined): number | null {
  const v = firstParam(raw)
  if (v === null) return null
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

const backLinkStyle: React.CSSProperties = {
  color: 'var(--theme-text)',
  textDecoration: 'underline',
}

function BackLink() {
  return (
    <p style={{ marginBottom: 12 }}>
      <Link href="/admin/nhan-xet-buoi" style={backLinkStyle}>
        ← Quay lại danh sách nhận xét buổi
      </Link>
    </p>
  )
}

export async function SessionFeedbackView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user || user.collection !== 'users') {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    )
  }

  let body: React.ReactNode
  {
    const studentId = parseId(searchParams?.student)
    const sessionId = parseId(searchParams?.session)
    const classId = parseId(searchParams?.class)
    const coachId = parseId(searchParams?.coach)
    const date = firstParam(searchParams?.date)
    const buoi = firstParam(searchParams?.buoi)

    if (studentId !== null) {
      // ── Theo HỌC VIÊN ────────────────────────────────────────────────
      const data = await loadStudentFeedbackTimeline(payload, user, studentId)
      body = (
        <>
          <BackLink />
          {data ? (
            <StudentFeedbackTimeline data={data} />
          ) : (
            <p>Không tìm thấy học viên (hoặc ngoài phạm vi cơ sở của bạn).</p>
          )}
        </>
      )
    } else {
      // ── Theo BUỔI ────────────────────────────────────────────────────
      let ref: SessionFeedbackRef | null = null
      if (sessionId !== null) ref = { sessionId }
      else if (classId !== null && date) ref = { classId, date }
      else if (coachId !== null && date) ref = { coachId, date }
      else if (buoi !== null) ref = { buoi }

      if (ref !== null) {
        const data = await loadSessionFeedback(payload, user, ref)
        body = (
          <>
            <BackLink />
            {data ? (
              <SessionFeedbackTable data={data} />
            ) : (
              <p>Không tìm thấy buổi này (hoặc ngoài phạm vi cơ sở của bạn).</p>
            )}
          </>
        )
      } else {
        // ── Landing: 2 tab ──────────────────────────────────────────────
        const [sessions, students, classes, locations, coaches] = await Promise.all([
          loadSessionList(payload, user),
          loadStudentFeedbackList(payload, user),
          loadClassOptions(payload, user),
          loadLocationOptions(payload, user),
          loadCoachOptions(payload, user),
        ])
        body = (
          <>
            <header style={{ marginBottom: 16 }}>
              <h1>Nhận xét buổi học</h1>
              <p style={{ color: 'var(--theme-elevation-500)' }}>
                Xem lại nhận xét từng buổi của học viên. Chọn <strong>Theo buổi dạy</strong> để xem
                nhận xét cả lớp trong một buổi, hoặc <strong>Theo học viên</strong> để xem tiến bộ
                của một em qua các buổi. Có thể sửa nhận xét ngay tại chỗ, lọc theo cơ sở/thứ/lớp và
                sửa hàng loạt.
              </p>
            </header>
            <FeedbackBrowserClient
              sessions={sessions}
              students={students}
              classes={classes}
              locations={locations}
              coaches={coaches}
            />
          </>
        )
      }
    }
  }

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>{body}</Gutter>
    </DefaultTemplate>
  )
}

export default SessionFeedbackView
