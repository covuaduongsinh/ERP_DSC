import { describe, it, expect, vi } from 'vitest';

import { makeCodeHook, type CodeSpec } from '@/lib/codes/makeCodeHook';
import { lockCodeHook } from '@/lib/codes/lockCodeHook';
import {
  CLASS_CODE_SPEC,
  EVENT_CODE_SPEC,
  BOOK_ISSUE_CODE_SPEC,
} from '@/lib/codes/field';
import type { CodeCounterPool } from '@/lib/codes/counters';

/**
 * Test mã định danh nghiệp vụ — Phase 3 (classes / events / book_issues +
 * Locations.code branch).
 *
 * Khác Phase 1/2: Classes lấy cơ sở từ quan hệ `location` → đọc `Locations.code`
 * qua `req.payload.findByID('locations', ...)`. Test mô phỏng findByID (cache
 * theo request) + pool atomic. Trọng tâm:
 *  - ĐỒNG THỜI N=50: Classes (branch từ location, liên tục) + Events (in NĂM ĐẦY
 *    ĐỦ) + BookIssues (reset/tháng).
 *  - Events: mã `GIAI-2026-NN` (4 chữ số năm), KHÁC YY 2 chữ số.
 *  - Classes throw khi thiếu location.
 *  - BẤT BIẾN: lockCodeHook chặn sửa code.
 */

// ── Fake pool: cùng ngữ nghĩa value+1 / GREATEST như SQL thật ─────────────────
function makeFakePool() {
  const store = new Map<string, number>();
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    const scope = String(params?.[0]);
    if (text.includes('GREATEST')) {
      const seedVal = Number(params?.[1]);
      const cur = store.get(scope) ?? 0;
      store.set(scope, Math.max(cur, seedVal));
      return { rows: [], rowCount: 1 };
    }
    const next = (store.get(scope) ?? 0) + 1;
    store.set(scope, next);
    return { rows: [{ value: next }], rowCount: 1 };
  });
  return { query, store } as CodeCounterPool & { store: Map<string, number> };
}

/**
 * Fake payload với `db.pool` (counter) + `findByID('locations')` trả `code` theo
 * map id→code. MỖI request 1 object riêng (cache resolveBranch theo request).
 */
function makeFakeReq(
  pool: CodeCounterPool,
  locations: Record<number, string | undefined> = {},
) {
  const findByID = vi.fn(
    async ({ collection, id }: { collection: string; id: number }) => {
      if (collection !== 'locations') return null;
      const code = locations[id];
      if (code === undefined) return null;
      return { id, code };
    },
  );
  return {
    payload: { db: { pool }, findByID },
    findByIDSpy: findByID,
  };
}

const runHook = (
  spec: CodeSpec,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req: any,
  data: Record<string, unknown>,
) =>
  makeCodeHook(spec)({
    data,
    operation: 'create',
    req,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

// ─── ĐỒNG THỜI (quan trọng nhất) ──────────────────────────────────────────────
describe('Phase 3 đồng thời — N=50 song song, mã duy nhất + liền mạch', () => {
  it('Classes: 50 create song song cùng cơ sở (location→KL) → LOP-KL-NNN seq 1..50', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool, { 7: 'KL' });
    const datas = Array.from({ length: 50 }, () => ({
      location: 7,
    })) as Record<string, unknown>[];

    await Promise.all(datas.map((d) => runHook(CLASS_CODE_SPEC, req, d)));

    const codes = datas.map((d) => d.code as string);
    expect(new Set(codes).size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^LOP-KL-\d{3}$/);
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('Classes: 2 cơ sở khác nhau → seq độc lập theo cơ sở', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool, { 7: 'KL', 8: 'VP' });
    const kl = { location: 7 } as Record<string, unknown>;
    const vp = { location: 8 } as Record<string, unknown>;
    await runHook(CLASS_CODE_SPEC, req, kl);
    await runHook(CLASS_CODE_SPEC, req, vp);
    expect(kl.code).toBe('LOP-KL-001');
    expect(vp.code).toBe('LOP-VP-001');
  });

  it('Classes: location dạng {id} (depth>0) vẫn phân giải được', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool, { 7: 'KL' });
    const data = { location: { id: 7, code: 'KL' } } as Record<string, unknown>;
    await runHook(CLASS_CODE_SPEC, req, data);
    expect(data.code).toBe('LOP-KL-001');
  });

  it('Events: 50 create song song cùng năm → GIAI-2026-NN (NĂM ĐẦY ĐỦ) seq 1..50', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    const datas = Array.from({ length: 50 }, () => ({
      date: '2026-05-20T00:00:00.000Z',
    })) as Record<string, unknown>[];

    await Promise.all(datas.map((d) => runHook(EVENT_CODE_SPEC, req, d)));

    const codes = datas.map((d) => d.code as string);
    expect(new Set(codes).size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^GIAI-2026-\d{2,}$/);
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('BookIssues: 50 create song song cùng tháng → XS-202606-NNNN seq 1..50', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    const datas = Array.from({ length: 50 }, () => ({
      ngayDung: '2026-06-15T00:00:00.000Z',
    })) as Record<string, unknown>[];

    await Promise.all(datas.map((d) => runHook(BOOK_ISSUE_CODE_SPEC, req, d)));

    const codes = datas.map((d) => d.code as string);
    expect(new Set(codes).size).toBe(50);
    for (const c of codes) expect(c).toMatch(/^XS-202606-\d{4}$/);
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b);
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });
});

// ─── Events: format NĂM ĐẦY ĐỦ 4 chữ số (yearDigits:4) ────────────────────────
describe('Phase 3 Events — mã in NĂM ĐẦY ĐỦ, reset/năm', () => {
  it('Events: mã đúng `GIAI-2026-01` (4 chữ số năm, KHÔNG phải YY)', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    const data = { date: '2026-03-01T00:00:00.000Z' } as Record<string, unknown>;
    await runHook(EVENT_CODE_SPEC, req, data);
    expect(data.code).toBe('GIAI-2026-01');
  });

  it('Events: 31/12/2025 và 01/01/2026 reset seq theo năm', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    const dec = { date: '2025-12-31T23:00:00.000Z' } as Record<string, unknown>;
    const jan = { date: '2026-01-01T01:00:00.000Z' } as Record<string, unknown>;
    await runHook(EVENT_CODE_SPEC, req, dec);
    await runHook(EVENT_CODE_SPEC, req, jan);
    expect(dec.code).toBe('GIAI-2025-01');
    expect(jan.code).toBe('GIAI-2026-01');
  });
});

// ─── BookIssues rollover tháng ────────────────────────────────────────────────
describe('Phase 3 BookIssues — reset/tháng theo ngayDung', () => {
  it('06→07 reset seq theo tháng', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    const jun = { ngayDung: '2026-06-30T00:00:00.000Z' } as Record<string, unknown>;
    const jul = { ngayDung: '2026-07-01T00:00:00.000Z' } as Record<string, unknown>;
    await runHook(BOOK_ISSUE_CODE_SPEC, req, jun);
    await runHook(BOOK_ISSUE_CODE_SPEC, req, jul);
    expect(jun.code).toBe('XS-202606-0001');
    expect(jul.code).toBe('XS-202607-0001');
  });
});

// ─── Classes: thiếu cơ sở → throw ─────────────────────────────────────────────
describe('Phase 3 Classes — thiếu/không phân giải được cơ sở → throw', () => {
  it('Classes: thiếu location → throw (cần cơ sở để sinh mã)', async () => {
    const pool = makeFakePool();
    const req = makeFakeReq(pool);
    await expect(runHook(CLASS_CODE_SPEC, req, {})).rejects.toThrow(/cơ sở/i);
  });

  it('Classes: location trỏ tới cơ sở CHƯA có code → throw', async () => {
    const pool = makeFakePool();
    // location id 9 tồn tại nhưng Locations.code chưa gán (undefined → null).
    const req = makeFakeReq(pool, { 9: undefined });
    await expect(
      runHook(CLASS_CODE_SPEC, req, { location: 9 }),
    ).rejects.toThrow(/cơ sở/i);
  });

  it('Classes: cache theo request — create TUẦN TỰ cùng location chỉ findByID 1 lần', async () => {
    // Cache populate sau lần đọc đầu; các create kế tiếp trong CÙNG request dùng
    // lại (tuần tự). Lưu ý: nhiều create ĐỒNG THỜI có thể cùng miss cache trước
    // khi lần đầu kịp ghi (race lành — vẫn đúng mã); ở đây kiểm hợp đồng dedup
    // tuần tự, là đường thường gặp (Payload xử lý từng doc).
    const pool = makeFakePool();
    const req = makeFakeReq(pool, { 7: 'KL' });
    const datas = Array.from({ length: 5 }, () => ({ location: 7 })) as Record<
      string,
      unknown
    >[];
    for (const d of datas) await runHook(CLASS_CODE_SPEC, req, d);
    expect(req.findByIDSpy).toHaveBeenCalledTimes(1);
    // Mã vẫn liền mạch 001..005.
    const seqs = datas
      .map((d) => Number((d.code as string).split('-')[2]))
      .sort((a, b) => a - b);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─── BẤT BIẾN (lockCodeHook) ──────────────────────────────────────────────────
describe('Phase 3 bất biến — lockCodeHook chặn sửa code mọi vai trò', () => {
  const admin = { collection: 'users', role: 'admin' };
  const run = (
    data: Record<string, unknown> | undefined,
    originalDoc: Record<string, unknown>,
    operation = 'update',
  ) =>
    lockCodeHook({
      data,
      operation,
      originalDoc,
      req: { user: admin },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

  it('Classes: update đổi code (kể cả admin) → throw', () => {
    expect(() => run({ code: 'LOP-KL-999' }, { code: 'LOP-KL-001' })).toThrow(
      /bất biến/i,
    );
  });

  it('Events: update field khác (không gửi code) → OK', () => {
    expect(run({ title: 'Giải mới' }, { code: 'GIAI-2026-01' })).toEqual({
      title: 'Giải mới',
    });
  });

  it('BookIssues: gửi lại code y nguyên → OK', () => {
    expect(run({ code: 'XS-202606-0001' }, { code: 'XS-202606-0001' })).toEqual({
      code: 'XS-202606-0001',
    });
  });
});
