/**
 * TEST CÁCH LY + ĐÚNG ĐẮN cho collection Payments và virtual field
 * `tuition_cycles.sessionsUsed`.
 *
 * Phần A — Cách ly dữ liệu thanh toán giữa hai phụ huynh:
 *   Phụ huynh A (con "Nguyễn Doãn Long") TUYỆT ĐỐI không lấy được Payment của
 *   con Phụ huynh B ("Đặng Minh Đức"), kể cả khi:
 *     (1) Local API overrideAccess:false giả lập req.user = phụ huynh A
 *         findByID sang payment của con người khác (IDOR).
 *     (2) Liệt kê — chỉ thấy payment con MÌNH.
 *     (3) Ẩn danh (không user) — không đọc được gì.
 *     (4) [nếu dev server :3005 đang chạy] REST IDOR + list bằng cookie phụ huynh.
 *
 * Phần B — sessionsUsed là giá trị TÍNH (không nhập tay):
 *     (5) Bằng số buổi Attendance status=co_mat của học viên.
 *     (6) Bỏ qua giá trị truyền tay lúc create (virtual → không lưu).
 *     (7) Cập nhật LIVE khi thêm buổi co_mat; KHÔNG đếm vang/phep.
 *
 * Chạy: pnpm --filter web payload run scripts/test-payments-access.ts
 * (Phần REST cần dev server ở :3005; nếu không có sẽ tự SKIP.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { normalizePhone } from '../src/lib/phone';
import { createParentSessionToken, PARENT_SESSION_COOKIE } from '../src/lib/parent-session';

const BASE = process.env.DS_TEST_BASE_URL ?? 'http://localhost:3005';

/** Bảo đảm có PARENT_SESSION_SECRET (đọc .env nếu payload run chưa nạp). */
function ensureEnv() {
  if (process.env.PARENT_SESSION_SECRET) return;
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
const add = (name: string, pass: boolean, detail: string) =>
  checks.push({ name, pass, detail });
const skips: string[] = [];

// ── helpers seed (idempotent) ──────────────────────────────────────────────
async function ensureStudent(payload: any, fullName: string): Promise<number> {
  const found = await payload.find({
    collection: 'students',
    where: { fullName: { equals: fullName } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  });
  if (found.totalDocs > 0) return found.docs[0].id as number;
  const created = await payload.create({
    collection: 'students',
    data: { fullName, enrollmentStatus: 'dang_hoc' },
    overrideAccess: true,
  });
  return created.id as number;
}

async function ensureParent(
  payload: any,
  fullName: string,
  rawPhone: string,
  childId: number,
): Promise<number> {
  const phone = normalizePhone(rawPhone);
  const found = await payload.find({
    collection: 'parents',
    where: { phone: { equals: phone } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  });
  if (found.totalDocs > 0) {
    const id = found.docs[0].id as number;
    await payload.update({
      collection: 'parents',
      id,
      data: { children: [childId] },
      overrideAccess: true,
    });
    return id;
  }
  const created = await payload.create({
    collection: 'parents',
    data: { fullName, phone, children: [childId] },
    overrideAccess: true,
  });
  return created.id as number;
}

/** Tạo (nếu chưa có) đúng 1 payment cho học viên; trả id. */
async function ensurePayment(payload: any, studentId: number, ghiChu: string): Promise<number> {
  const found = await payload.find({
    collection: 'payments',
    where: { and: [{ student: { equals: studentId } }, { ghiChu: { equals: ghiChu } }] },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  });
  if (found.totalDocs > 0) return found.docs[0].id as number;
  const created = await payload.create({
    collection: 'payments',
    data: {
      student: studentId,
      ngayNop: new Date().toISOString(),
      hocPhi: 1000000,
      soBuoiNop: 10,
      coSo: 'kim_lien',
      tinhTrang: 'da_nop',
      ghiChu,
    },
    overrideAccess: true,
  });
  return created.id as number;
}

async function httpGet(url: string, cookie?: string) {
  const res = await fetch(url, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

async function serverUp(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/api/access`, { redirect: 'manual' });
    return res.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  ensureEnv();
  const payload = await getPayload({ config: await config });

  // ── Seed fixtures cách ly (idempotent) ──
  const studentA = await ensureStudent(payload, 'Nguyễn Doãn Long');
  const studentB = await ensureStudent(payload, 'Đặng Minh Đức');
  const parentAId = await ensureParent(payload, 'PH Test A', '0900000001', studentA);
  const parentBId = await ensureParent(payload, 'PH Test B', '0900000002', studentB);
  await payload.update({ collection: 'students', id: studentA, data: { parents: [parentAId] }, overrideAccess: true });
  await payload.update({ collection: 'students', id: studentB, data: { parents: [parentBId] }, overrideAccess: true });

  const paymentA = await ensurePayment(payload, studentA, '[test] payment con A');
  const paymentB = await ensurePayment(payload, studentB, '[test] payment con B');

  const parentA = await payload.findByID({ collection: 'parents', id: parentAId, overrideAccess: true, depth: 0 });
  const parentAUser = { ...parentA, collection: 'parents' } as any;

  console.error('[test] studentA', studentA, 'paymentA', paymentA, '| studentB', studentB, 'paymentB', paymentB);

  // ── (1) Local API IDOR: A.findByID(paymentB) bị chặn ──
  let localBlocked = false;
  let localDetail = '';
  try {
    const doc = await payload.findByID({
      collection: 'payments',
      id: paymentB,
      overrideAccess: false,
      user: parentAUser,
      depth: 0,
    });
    localBlocked = !doc;
    localDetail = doc ? `TRẢ VỀ doc id=${doc.id} (RÒ RỈ!)` : 'trả null';
  } catch (e) {
    localBlocked = true;
    localDetail = `throw ${(e as Error).name}`;
  }
  add('Local API: A.findByID(paymentB) bị chặn', localBlocked, localDetail);

  // Sanity: A đọc được payment con MÌNH.
  let ownOk = false;
  let ownDetail = '';
  try {
    const doc = await payload.findByID({
      collection: 'payments',
      id: paymentA,
      overrideAccess: false,
      user: parentAUser,
      depth: 0,
    });
    ownOk = !!doc && doc.id === paymentA;
    ownDetail = doc ? `đọc được id=${doc.id}` : 'trả null (SAI — phải đọc được con mình)';
  } catch (e) {
    ownDetail = `throw ${(e as Error).name} (SAI)`;
  }
  add('Local API: A đọc được payment con mình', ownOk, ownDetail);

  // ── (2) Local API list as A → chỉ con mình ──
  const localList = await payload.find({
    collection: 'payments',
    overrideAccess: false,
    user: parentAUser,
    limit: 500,
    depth: 0,
  });
  const localLeak = localList.docs.filter((d: any) => {
    const sid = typeof d.student === 'object' ? d.student?.id : d.student;
    return sid !== studentA;
  });
  add(
    'Local API list: A chỉ thấy payment con mình',
    localList.docs.length > 0 && localLeak.length === 0,
    `tổng=${localList.docs.length} rò rỉ(khác studentA)=${localLeak.length}`,
  );

  // ── (3) Ẩn danh (không user) → không đọc được ──
  // access trả false → Payload THROW Forbidden (403); đó là "bị chặn" = PASS.
  // (Nếu trả docs rỗng cũng coi là chặn.)
  let anonBlocked = false;
  let anonDetail = '';
  try {
    const anonList = await payload.find({
      collection: 'payments',
      overrideAccess: false,
      limit: 500,
      depth: 0,
    });
    anonBlocked = anonList.docs.length === 0;
    anonDetail = `không throw; tổng=${anonList.docs.length} (mong đợi 0)`;
  } catch (e) {
    anonBlocked = (e as { status?: number }).status === 403 || /forbidden/i.test((e as Error).message);
    anonDetail = `throw ${(e as Error).name} status=${(e as { status?: number }).status ?? '?'}`;
  }
  add('Local API: ẩn danh KHÔNG đọc được payment nào', anonBlocked, anonDetail);

  // ── (4) REST (nếu server :3005 chạy) ──
  if (await serverUp()) {
    const tokenA = createParentSessionToken(parentAId).token;
    const cookieA = `${PARENT_SESSION_COOKIE}=${encodeURIComponent(tokenA)}`;

    const idor = await httpGet(`${BASE}/api/payments/${paymentB}`, cookieA);
    add(
      'REST IDOR: A đọc /api/payments/<paymentB>',
      idor.status !== 200 || !idor.body || idor.body.id !== paymentB,
      `status=${idor.status} body.id=${idor.body?.id ?? '∅'} (mong đợi KHÔNG trả paymentB)`,
    );

    const ownGet = await httpGet(`${BASE}/api/payments/${paymentA}`, cookieA);
    add(
      'REST own: A đọc /api/payments/<paymentA>',
      ownGet.status === 200 && ownGet.body?.id === paymentA,
      `status=${ownGet.status} body.id=${ownGet.body?.id ?? '∅'}`,
    );

    const list = await httpGet(`${BASE}/api/payments?limit=500&depth=0`, cookieA);
    const docs: any[] = list.body?.docs ?? [];
    const leaked = docs.filter((d) => {
      const sid = typeof d.student === 'object' ? d.student?.id : d.student;
      return sid !== studentA;
    });
    add(
      'REST list: A chỉ thấy payment con mình',
      list.status === 200 && docs.length > 0 && leaked.length === 0,
      `status=${list.status} tổng=${docs.length} rò rỉ=${leaked.length}`,
    );

    const anon = await httpGet(`${BASE}/api/payments/${paymentA}`);
    add(
      'REST anon: ẩn danh KHÔNG đọc được paymentA',
      anon.status !== 200 || !anon.body || anon.body.id !== paymentA,
      `status=${anon.status} body.id=${anon.body?.id ?? '∅'}`,
    );
  } else {
    skips.push('REST checks (4): dev server :3005 không chạy — bỏ qua. Local API đã phủ cùng access function.');
  }

  // ── Phần B: sessionsUsed TÍNH từ Attendance ──────────────────────────────
  const baseline = (
    await payload.count({
      collection: 'attendance',
      where: { and: [{ student: { equals: studentA } }, { status: { equals: 'co_mat' } }] },
      overrideAccess: true,
    })
  ).totalDocs;

  // Tạo cycle cho studentA, CỐ TÌNH truyền sessionsUsed=999 (phải bị bỏ qua).
  const cycle = await payload.create({
    collection: 'tuition-cycles',
    data: {
      student: studentA,
      package: '10',
      sessionsTotal: 10,
      sessionsUsed: 999 as any,
      startDate: new Date().toISOString(),
      status: 'dang_hoc',
    },
    overrideAccess: true,
  });
  const createdAttendance: number[] = [];
  try {
    const read1 = await payload.findByID({ collection: 'tuition-cycles', id: cycle.id, overrideAccess: true, depth: 0 });
    add(
      '(5)(6) sessionsUsed = đếm co_mat, bỏ qua giá trị truyền tay 999',
      read1.sessionsUsed === baseline,
      `đọc=${read1.sessionsUsed} baseline(co_mat)=${baseline} (đã truyền 999 lúc create)`,
    );

    // Thêm 2 buổi co_mat + 1 vang + 1 phep cho studentA.
    const statuses: Array<'co_mat' | 'vang' | 'phep'> = ['co_mat', 'co_mat', 'vang', 'phep'];
    for (const status of statuses) {
      const a = await payload.create({
        collection: 'attendance',
        data: { student: studentA, date: new Date().toISOString(), status, note: '[test-payments] tmp' },
        overrideAccess: true,
      });
      createdAttendance.push(a.id as number);
    }

    const read2 = await payload.findByID({ collection: 'tuition-cycles', id: cycle.id, overrideAccess: true, depth: 0 });
    add(
      '(7) sessionsUsed cập nhật LIVE +2 (chỉ đếm co_mat, bỏ vang/phep)',
      read2.sessionsUsed === baseline + 2,
      `đọc=${read2.sessionsUsed} mong đợi=${baseline + 2} (đã thêm 2 co_mat + 1 vang + 1 phep)`,
    );
  } finally {
    // Dọn dẹp để idempotent qua nhiều lần chạy.
    for (const id of createdAttendance) {
      await payload.delete({ collection: 'attendance', id, overrideAccess: true }).catch(() => {});
    }
    await payload.delete({ collection: 'tuition-cycles', id: cycle.id, overrideAccess: true }).catch(() => {});
  }

  // ── In kết quả ──
  const out: string[] = ['\n=== TEST CÁCH LY PAYMENTS + sessionsUsed TÍNH ==='];
  let allPass = true;
  for (const c of checks) {
    if (!c.pass) allPass = false;
    out.push(`  ${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.name}\n           ${c.detail}`);
  }
  for (const s of skips) out.push(`  ⏭️  SKIP  ${s}`);
  out.push(
    allPass
      ? '\n🎉 TẤT CẢ PASS — cách ly payment ổn; sessionsUsed tính đúng từ Attendance.'
      : '\n🚨 CÓ CHECK FAIL — xem chi tiết phía trên.',
  );
  process.stderr.write(out.join('\n') + '\n');
  process.exitCode = allPass ? 0 : 1;
}

try {
  await main();
} catch (err) {
  console.error('✗ Test thất bại:', err);
  process.exitCode = 1;
}
process.exit(process.exitCode ?? 0);
