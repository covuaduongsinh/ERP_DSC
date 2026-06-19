import { describe, it, expect } from 'vitest';

import { getTrackForLevel, getTracksForLevels, trackOrder, type ChessLevel } from '@/lib/roadmap';
import {
  groupOpenClassesByTrack,
  type OpenClassCard,
} from '@/lib/open-classes';

const card = (id: number, ...level: ChessLevel[]): OpenClassCard => ({
  id,
  level,
  track: getTracksForLevels(level),
  ageGroup: ['cap_1_cap_2'],
  title: `Lớp ${id}`,
  locationName: 'Cơ sở A',
  schedule: [{ thu: 't2', gioBatDau: '18:00', gioKetThuc: '19:15' }],
});

describe('getTrackForLevel', () => {
  it('ánh xạ 6 cấp vào đúng tuyến', () => {
    expect(getTrackForLevel('tot')).toBe('nhap_mon');
    expect(getTrackForLevel('ma')).toBe('co_ban');
    expect(getTrackForLevel('tuong')).toBe('co_ban');
    expect(getTrackForLevel('xe')).toBe('co_ban');
    expect(getTrackForLevel('hau')).toBe('nang_cao');
    expect(getTrackForLevel('vua')).toBe('nang_cao');
  });

  it('cấp rỗng/null → null', () => {
    expect(getTrackForLevel(null)).toBeNull();
    expect(getTrackForLevel(undefined)).toBeNull();
  });

  it('trackOrder đúng thứ tự thấp → cao', () => {
    expect(trackOrder).toEqual(['nhap_mon', 'co_ban', 'nang_cao']);
  });
});

describe('groupOpenClassesByTrack', () => {
  it('gom theo tuyến, thứ tự theo trackOrder bất kể input', () => {
    const groups = groupOpenClassesByTrack([
      card(1, 'vua'),
      card(2, 'tot'),
      card(3, 'ma'),
    ]);
    expect(groups.map((g) => g.track)).toEqual(['nhap_mon', 'co_ban', 'nang_cao']);
  });

  it('trong tuyến sắp theo levelOrder (Mã → Tượng → Xe)', () => {
    const groups = groupOpenClassesByTrack([
      card(1, 'xe'),
      card(2, 'ma'),
      card(3, 'tuong'),
    ]);
    // Tất cả thuộc Cơ bản → 1 nhóm, sắp Mã(2) → Tượng(3) → Xe(1).
    expect(groups).toHaveLength(1);
    expect(groups[0].track).toBe('co_ban');
    expect(groups[0].classes.map((c) => c.id)).toEqual([2, 3, 1]);
  });

  it('bỏ tuyến rỗng', () => {
    const groups = groupOpenClassesByTrack([card(1, 'tot')]);
    expect(groups.map((g) => g.track)).toEqual(['nhap_mon']);
  });

  it('lớp NHIỀU tuyến xuất hiện ở mỗi tuyến tương ứng', () => {
    const groups = groupOpenClassesByTrack([card(1, 'tot', 'hau')]);
    expect(groups.map((g) => g.track)).toEqual(['nhap_mon', 'nang_cao']);
    expect(groups[0].classes.map((c) => c.id)).toEqual([1]);
    expect(groups[1].classes.map((c) => c.id)).toEqual([1]);
  });

  it('input rỗng → mảng rỗng', () => {
    expect(groupOpenClassesByTrack([])).toEqual([]);
  });
});
