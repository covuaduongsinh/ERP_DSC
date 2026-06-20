import { getPayload, type Payload } from 'payload'
import config from '@/payload.config'
import { describe, it, beforeAll, expect } from 'vitest'
import type { User } from '@/payload-types'

/**
 * SMOKE RUNTIME `class-sessions` 🔒 — chạy Payload THẬT trên DB để đóng "nợ verify"
 * nền Buổi học:
 *  1. Payload truy vấn được bảng `class_sessions` (DDL migration khớp schema Payload
 *     sinh từ config — nếu lệch cột/kiểu thì SELECT sẽ ném).
 *  2. Postgres dịch ĐÚNG filter branch-scope `location` (GĐ2: scope trực tiếp qua cơ sở).
 *  3. Fail-closed: staff chưa gán cơ sở bị từ chối.
 *
 * Read-only (không ghi). Mục tiêu là SELECT chạy KHÔNG lỗi (kể cả khi bảng rỗng).
 */

let payload: Payload
let locA: number | null = null

const coachAt = (locationId: number | null): User =>
  ({ id: -1, collection: 'users', role: 'coach', location: locationId }) as unknown as User

describe('class-sessions RUNTIME smoke 🔒 (Postgres thực thi branch-scope location)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const { docs } = await payload.find({
      collection: 'locations',
      overrideAccess: true,
      limit: 1,
      depth: 0,
      sort: 'id',
    })
    locA = docs[0] ? (docs[0] as { id: number }).id : null
  })

  it('truy vấn class-sessions (overrideAccess) — bảng tồn tại & SELECT chạy không lỗi', async () => {
    await expect(
      payload.find({ collection: 'class-sessions', overrideAccess: true, limit: 1, depth: 0 }),
    ).resolves.toBeTruthy()
  })

  it('branch-scope: coach khóa cơ sở A — filter location chạy (scoped ≤ global)', async () => {
    if (locA === null) return
    const total = await payload.count({ collection: 'class-sessions', overrideAccess: true })
    const scoped = await payload.count({
      collection: 'class-sessions',
      user: coachAt(locA),
      overrideAccess: false,
    })
    expect(scoped.totalDocs).toBeLessThanOrEqual(total.totalDocs)
  })

  it('fail-closed: coach CHƯA gán cơ sở bị TỪ CHỐI (access=false ⇒ Forbidden)', async () => {
    await expect(
      payload.find({
        collection: 'class-sessions',
        user: coachAt(null),
        overrideAccess: false,
        limit: 0,
      }),
    ).rejects.toThrow()
  })
})
