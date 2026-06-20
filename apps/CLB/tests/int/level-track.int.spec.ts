import { describe, it, expect } from 'vitest'

import { resolveLevelTrack } from '@/lib/classes/level-track'

describe('resolveLevelTrack — tự suy 2 chiều Cấp ↔ Tuyến', () => {
  it('chỉ chọn Cấp ⇒ Tuyến tự suy (dedupe + đúng thứ tự trackOrder)', () => {
    expect(resolveLevelTrack({ level: ['tot', 'hau'] })).toEqual({
      level: ['tot', 'hau'],
      track: ['nhap_mon', 'nang_cao'],
    })
    // Mã + Xe đều thuộc Cơ bản ⇒ gộp về 1 tuyến.
    expect(resolveLevelTrack({ level: ['ma', 'xe'] })).toEqual({
      level: ['ma', 'xe'],
      track: ['co_ban'],
    })
  })

  it('chỉ chọn Tuyến ⇒ Cấp tự suy (gom đủ cấp của tuyến, đúng thứ tự levelOrder)', () => {
    expect(resolveLevelTrack({ track: ['co_ban'] })).toEqual({
      level: ['ma', 'tuong', 'xe'],
      track: ['co_ban'],
    })
    expect(resolveLevelTrack({ track: ['nhap_mon', 'nang_cao'] })).toEqual({
      level: ['tot', 'hau', 'vua'],
      track: ['nhap_mon', 'nang_cao'],
    })
  })

  it('THÊM Cấp (đổi Cấp, không đổi Tuyến) ⇒ Tuyến suy lại từ Cấp [bug đã sửa]', () => {
    expect(
      resolveLevelTrack({
        level: ['ma', 'tuong', 'xe', 'hau'],
        track: ['co_ban'],
        levelChanged: true,
        trackChanged: false,
      }),
    ).toEqual({
      level: ['ma', 'tuong', 'xe', 'hau'],
      track: ['co_ban', 'nang_cao'],
    })
  })

  it('đổi Tuyến (không đổi Cấp) ⇒ Cấp bám theo Tuyến mới', () => {
    expect(
      resolveLevelTrack({
        level: ['ma', 'tuong', 'xe'],
        track: ['nang_cao'],
        levelChanged: false,
        trackChanged: true,
      }),
    ).toEqual({
      level: ['hau', 'vua'],
      track: ['nang_cao'],
    })
  })

  it('đổi CẢ HAI cùng lúc ⇒ Cấp là nguồn (Tuyến suy từ Cấp)', () => {
    expect(
      resolveLevelTrack({
        level: ['tot'],
        track: ['nang_cao'],
        levelChanged: true,
        trackChanged: true,
      }),
    ).toEqual({
      level: ['tot'],
      track: ['nhap_mon'],
    })
  })

  it('CẢ HAI trống ⇒ ném lỗi tiếng Việt', () => {
    expect(() => resolveLevelTrack({})).toThrow('ít nhất một Cấp độ hoặc một Tuyến')
    expect(() => resolveLevelTrack({ level: [], track: [] })).toThrow()
  })
})
