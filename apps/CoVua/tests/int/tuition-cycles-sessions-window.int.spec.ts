import type { FieldHook, Where } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import {
  resolveStudentId,
  buildSessionsUsedWhere,
  countAttendedSessions,
} from '@/collections/TuitionCycles'

/**
 * Unit test (không cần DB) cho cửa sổ đếm `sessionsUsed` của TuitionCycles.
 *
 * Trọng tâm: chỉ đếm buổi của ĐÚNG học viên, status=co_mat, và `date` nằm trong
 * [startDate, expectedEndDate] — bao trùm cả ngày ở 2 đầu mút; expectedEndDate
 * rỗng ⇒ cửa mở. `buildSessionsUsedWhere` thuần nên test được mọi ca biên; phần
 * đụng DB (`req.payload.count`) được mock.
 */

// ── Helpers đọc lại các mệnh đề trong where.and ──────────────────────────────
const clauses = (where: Where | null): Where[] => (where?.and as Where[] | undefined) ?? []

const studentClause = (where: Where | null) =>
  clauses(where).find((c) => 'student' in c) as { student: { equals: number } } | undefined

const statusClause = (where: Where | null) =>
  clauses(where).find((c) => 'status' in c) as { status: { equals: string } } | undefined

const dateClause = (where: Where | null) =>
  clauses(where).find((c) => 'date' in c) as
    | { date: { greater_than_equal?: string; less_than_equal?: string } }
    | undefined

const lowerBound = (where: Where | null): string | undefined => {
  const c = clauses(where).find(
    (x) => 'date' in x && 'greater_than_equal' in (x as { date: object }).date,
  ) as { date: { greater_than_equal: string } } | undefined
  return c?.date.greater_than_equal
}

const upperBound = (where: Where | null): string | undefined => {
  const c = clauses(where).find(
    (x) => 'date' in x && 'less_than_equal' in (x as { date: object }).date,
  ) as { date: { less_than_equal: string } } | undefined
  return c?.date.less_than_equal
}

describe('resolveStudentId', () => {
  it('chấp nhận id số', () => {
    expect(resolveStudentId(5)).toBe(5)
  })

  it('rút id từ object quan hệ đã populate', () => {
    expect(resolveStudentId({ id: 7 })).toBe(7)
  })

  it('trả undefined cho null / undefined / object thiếu id', () => {
    expect(resolveStudentId(null)).toBeUndefined()
    expect(resolveStudentId(undefined)).toBeUndefined()
    expect(resolveStudentId({})).toBeUndefined()
    expect(resolveStudentId({ id: null })).toBeUndefined()
  })
})

describe('buildSessionsUsedWhere', () => {
  it('trả null khi chu kỳ chưa có học viên hợp lệ (⇒ caller coi như 0)', () => {
    expect(
      buildSessionsUsedWhere({ startDate: '2026-01-01', expectedEndDate: '2026-03-01' }),
    ).toBeNull()
    expect(buildSessionsUsedWhere({ student: null, startDate: '2026-01-01' })).toBeNull()
  })

  it('luôn lọc đúng học viên và status=co_mat (loại vắng/phép)', () => {
    const where = buildSessionsUsedWhere({
      student: 42,
      startDate: '2026-01-15',
      expectedEndDate: '2026-03-20',
    })
    expect(studentClause(where)?.student.equals).toBe(42)
    expect(statusClause(where)?.status.equals).toBe('co_mat')
  })

  it('rút id học viên từ object quan hệ đã populate', () => {
    const where = buildSessionsUsedWhere({ student: { id: 9 }, startDate: '2026-01-15' })
    expect(studentClause(where)?.student.equals).toBe(9)
  })

  it('cận dưới = ĐẦU ngày (UTC) của startDate, bất kể giờ', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: '2026-01-15T08:30:00.000Z',
      expectedEndDate: '2026-03-20T08:30:00.000Z',
    })
    expect(lowerBound(where)).toBe('2026-01-15T00:00:00.000Z')
  })

  it('cận trên = CUỐI ngày (UTC) của expectedEndDate ⇒ buổi lúc 23:59 vẫn tính', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: '2026-01-15T08:30:00.000Z',
      expectedEndDate: '2026-03-20T08:30:00.000Z',
    })
    expect(upperBound(where)).toBe('2026-03-20T23:59:59.999Z')
  })

  it('expectedEndDate null ⇒ CỬA MỞ: chỉ có cận dưới, không có cận trên', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: '2026-01-15',
      expectedEndDate: null,
    })
    expect(lowerBound(where)).toBe('2026-01-15T00:00:00.000Z')
    expect(upperBound(where)).toBeUndefined()
  })

  it('expectedEndDate undefined ⇒ cũng là cửa mở', () => {
    const where = buildSessionsUsedWhere({ student: 1, startDate: '2026-01-15' })
    expect(upperBound(where)).toBeUndefined()
    expect(dateClause(where)).toBeDefined()
  })

  it('startDate rỗng ⇒ không chặn cận dưới (phòng thủ)', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: null,
      expectedEndDate: '2026-03-20',
    })
    expect(lowerBound(where)).toBeUndefined()
    expect(upperBound(where)).toBe('2026-03-20T23:59:59.999Z')
  })

  it('không có ngày nào ⇒ chỉ student + status, không mệnh đề date', () => {
    const where = buildSessionsUsedWhere({ student: 3 })
    expect(clauses(where)).toHaveLength(2)
    expect(dateClause(where)).toBeUndefined()
  })

  it('ngày không hợp lệ ⇒ bỏ qua cận đó (không throw)', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: 'không-phải-ngày',
      expectedEndDate: '2026-03-20',
    })
    expect(lowerBound(where)).toBeUndefined()
    expect(upperBound(where)).toBe('2026-03-20T23:59:59.999Z')
  })

  it('nhận cả Date object lẫn chuỗi ISO cho mốc ngày', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: new Date('2026-01-15T08:30:00.000Z'),
      expectedEndDate: new Date('2026-03-20T08:30:00.000Z'),
    })
    expect(lowerBound(where)).toBe('2026-01-15T00:00:00.000Z')
    expect(upperBound(where)).toBe('2026-03-20T23:59:59.999Z')
  })

  it('chuỗi ngày-không-giờ "YYYY-MM-DD" giữ đúng đầu/cuối ngày UTC', () => {
    const where = buildSessionsUsedWhere({
      student: 1,
      startDate: '2026-01-15',
      expectedEndDate: '2026-03-20',
    })
    expect(lowerBound(where)).toBe('2026-01-15T00:00:00.000Z')
    expect(upperBound(where)).toBe('2026-03-20T23:59:59.999Z')
  })
})

// ── Hook afterRead: dùng lại where ở trên + đếm qua Payload (mock count) ──────
const callHook = (data: Record<string, unknown>, count = vi.fn()) => {
  const req = { payload: { count } } as unknown as Parameters<FieldHook>[0]['req']
  return (countAttendedSessions as FieldHook)({ data, req } as Parameters<FieldHook>[0])
}

describe('countAttendedSessions (hook)', () => {
  it('truyền đúng where + overrideAccess và trả totalDocs', async () => {
    const count = vi.fn().mockResolvedValue({ totalDocs: 3 })
    const data = { student: 5, startDate: '2026-01-15', expectedEndDate: '2026-03-20' }

    const result = await callHook(data, count)

    expect(result).toBe(3)
    expect(count).toHaveBeenCalledTimes(1)
    const arg = count.mock.calls[0][0]
    expect(arg.collection).toBe('attendance')
    expect(arg.overrideAccess).toBe(true)
    expect(arg.where).toEqual(buildSessionsUsedWhere(data))
  })

  it('không có học viên ⇒ trả 0 và KHÔNG truy vấn DB', async () => {
    const count = vi.fn()
    const result = await callHook({ startDate: '2026-01-15' }, count)

    expect(result).toBe(0)
    expect(count).not.toHaveBeenCalled()
  })
})
