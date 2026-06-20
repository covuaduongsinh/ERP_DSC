import type { Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import { importClasses, parseLichHoc } from '@/lib/imports/classes'

// ─── Fake payload: locations + coaches nạp 1 lần; classes khớp theo title ──────────
type Doc = Record<string, unknown>
function makePayload(opts: { locations?: Doc[]; coaches?: Doc[]; classes?: Doc[] }) {
  const create = vi.fn(async () => ({ id: 999 }))
  const update = vi.fn(async () => ({ id: 0 }))
  const find = vi.fn(async ({ collection, where }: { collection: string; where?: any }) => {
    if (collection === 'locations')
      return { docs: opts.locations ?? [], totalDocs: (opts.locations ?? []).length }
    if (collection === 'coaches')
      return { docs: opts.coaches ?? [], totalDocs: (opts.coaches ?? []).length }
    if (collection === 'classes') {
      const title = where?.title?.equals
      const docs = (opts.classes ?? []).filter((c) => c.title === title)
      return { docs, totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  })
  return { payload: { find, create, update } as unknown as Payload, create, update, find }
}

const LOCS = [
  { id: 2, name: 'Cơ sở Kim Liên — Đống Đa' },
  { id: 3, name: 'Cơ sở Vĩnh Phúc - Ba Đình' },
]
const COACHES = [
  { id: 15, tenTat: 'Trúc' },
  { id: 10, tenTat: 'Quyên' },
]
const row = (r: Record<string, string>) => r

describe('parseLichHoc — parse lịch gọn', () => {
  it('nhiều buổi + phòng', () => {
    const { slots, warnings } = parseLichHoc('T2 17:00-18:30 A1; T5 17:00-18:30')
    expect(warnings).toHaveLength(0)
    expect(slots).toEqual([
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
      { thu: 't5', gioBatDau: '17:00', gioKetThuc: '18:30' },
    ])
  })
  it('slot sai → cảnh báo, bỏ qua', () => {
    const { slots, warnings } = parseLichHoc('T2 abc; T9 17:00-18:30')
    expect(slots).toHaveLength(0)
    expect(warnings).toHaveLength(2)
  })
})

describe('importClasses — idempotent theo title 🔒', () => {
  it('lớp mới hợp lệ ⇒ created, khớp cơ sở/cấp/GV/lịch', async () => {
    const { payload, create } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({
        ten_lop: 'Lớp Tốt 1 - Kim Liên',
        cap_do: 'Tốt',
        nhom_tuoi: 'Cấp 1 - Cấp 2',
        co_so: 'Kim Liên',
        gv: 'Quyên',
        si_so_toi_da: '15',
        lich_hoc: 'T2 17:00-18:30 A1',
      }),
    ])
    expect(r.created).toBe(1)
    expect(r.errors).toBe(0)
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data).toMatchObject({
      title: 'Lớp Tốt 1 - Kim Liên',
      level: ['tot'],
      ageGroup: ['cap_1_cap_2'],
      location: 2,
      coach: 10,
      siSoToiDa: 15,
    })
    expect(arg.data.lichHoc).toHaveLength(1)
  })

  it('cap_do gồm nhiều cấp ⇒ level mảng (tuyến tự suy qua hook collection)', async () => {
    const { payload, create } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({
        ten_lop: 'Lớp Gộp',
        cap_do: 'Tốt, Hậu',
        nhom_tuoi: 'Cấp 1 - Cấp 2',
        co_so: 'Kim Liên',
      }),
    ])
    expect(r.created).toBe(1)
    expect(r.errors).toBe(0)
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.level).toEqual(['tot', 'hau'])
  })

  it('nhom_tuoi gồm cả hai ⇒ ageGroup mảng 2 nhóm', async () => {
    const { payload, create } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({
        ten_lop: 'Lớp Chung',
        cap_do: 'Tốt',
        nhom_tuoi: 'Mầm non, Cấp 1 - Cấp 2',
        co_so: 'Kim Liên',
      }),
    ])
    expect(r.created).toBe(1)
    expect(r.errors).toBe(0)
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.ageGroup).toEqual(['mam_non_4_6', 'cap_1_cap_2'])
  })

  it('thiếu ten_lop / cap_do sai / co_so không khớp ⇒ error', async () => {
    const { payload } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({ cap_do: 'Tốt', nhom_tuoi: 'Mầm non', co_so: 'Kim Liên' }),
      row({ ten_lop: 'X', cap_do: 'SaiCap', nhom_tuoi: 'Mầm non', co_so: 'Kim Liên' }),
      row({ ten_lop: 'Y', cap_do: 'Tốt', nhom_tuoi: 'Mầm non', co_so: 'Không Tồn Tại' }),
    ])
    expect(r.errors).toBe(3)
    expect(r.created).toBe(0)
  })

  it('GV không khớp tenTat ⇒ vẫn created kèm cảnh báo', async () => {
    const { payload, create } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({
        ten_lop: 'Lớp Z',
        cap_do: 'Mã',
        nhom_tuoi: 'Mầm non',
        co_so: 'Vĩnh Phúc',
        gv: 'KhôngCó',
      }),
    ])
    expect(r.created).toBe(1)
    const o = r.outcomes[0]
    expect(o.status === 'created' && o.warning).toBeTruthy()
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.coach).toBeUndefined()
  })

  it('title đã tồn tại ⇒ updated (không create)', async () => {
    const { payload, create, update } = makePayload({
      locations: LOCS,
      coaches: COACHES,
      classes: [{ id: 5, title: 'Lớp Tốt 1 - Kim Liên' }],
    })
    const r = await importClasses(payload, 'f.csv', [
      row({
        ten_lop: 'Lớp Tốt 1 - Kim Liên',
        cap_do: 'Tốt',
        nhom_tuoi: 'Cấp 1',
        co_so: 'Kim Liên',
      }),
    ])
    expect(r.updated).toBe(1)
    expect(update).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
  })

  it('trùng title trong file ⇒ skipped', async () => {
    const { payload } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(payload, 'f.csv', [
      row({ ten_lop: 'Lớp A', cap_do: 'Tốt', nhom_tuoi: 'Mầm non', co_so: 'Kim Liên' }),
      row({ ten_lop: 'Lớp A', cap_do: 'Tốt', nhom_tuoi: 'Mầm non', co_so: 'Kim Liên' }),
    ])
    expect(r.created).toBe(1)
    expect(r.skipped).toBe(1)
  })

  it('dryRun ⇒ không gọi create/update', async () => {
    const { payload, create, update } = makePayload({ locations: LOCS, coaches: COACHES })
    const r = await importClasses(
      payload,
      'f.csv',
      [row({ ten_lop: 'Lớp Dry', cap_do: 'Tốt', nhom_tuoi: 'Mầm non', co_so: 'Kim Liên' })],
      { dryRun: true },
    )
    expect(r.created).toBe(1)
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
