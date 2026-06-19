'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type {
  ClassOption,
  ClassRosterRow,
  EnrollableStudent,
} from '@/lib/operations/roster';
import { fetchClassRoster } from '@/app/actions/quickAttendance';
import {
  addStudentToClassAction,
  removeStudentFromClassAction,
  transferStudentClassAction,
  bulkRemoveStudentsFromClassAction,
  bulkTransferStudentsClassAction,
} from '@/app/actions/enrollment';

export interface ClassRosterClientProps {
  classes: ClassOption[];
  enrollableStudents: EnrollableStudent[];
  /** Mở sẵn lớp này (vd bấm từ cột "Sĩ số hiện tại" ở bảng Lớp học). */
  initialClassId?: number;
}

const STATUS_LABELS: Record<string, string> = {
  dang_hoc: 'Đang học',
  tam_nghi: 'Tạm nghỉ',
  da_nghi: 'Đã nghỉ',
};

export function ClassRosterClient({
  classes,
  enrollableStudents,
  initialClassId,
}: ClassRosterClientProps) {
  // Chỉ preselect nếu lớp nằm trong phạm vi của người dùng (fail-closed).
  const validInitialId = useMemo(
    () =>
      typeof initialClassId === 'number' && classes.some((c) => c.id === initialClassId)
        ? initialClassId
        : '',
    [classes, initialClassId],
  );
  const [classId, setClassId] = useState<number | ''>(validInitialId);
  const [rows, setRows] = useState<ClassRosterRow[]>([]);
  const [picked, setPicked] = useState(Boolean(validInitialId));
  const [loading, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const reload = useCallback((id: number) => {
    setSelected(new Set());
    startLoad(async () => {
      const res = await fetchClassRoster(id);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRows(res.rows);
    });
  }, []);

  // Auto-load khi mở qua `?class=ID`.
  useEffect(() => {
    if (validInitialId) reload(validInitialId as number);
    // chỉ chạy 1 lần theo lớp khởi tạo
  }, [validInitialId, reload]);

  const onPickClass = useCallback(
    (value: string) => {
      setError(null);
      setNotice(null);
      setSearch('');
      const id = value ? Number(value) : '';
      setClassId(id);
      setRows([]);
      setPicked(Boolean(id));
      if (id) reload(id as number);
    },
    [reload],
  );

  const rosterIds = useMemo(() => new Set(rows.map((r) => r.studentId)), [rows]);
  const selectedClass = useMemo(
    () => (classId ? classes.find((c) => c.id === classId) ?? null : null),
    [classes, classId],
  );

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return enrollableStudents
      .filter((s) => !rosterIds.has(s.id))
      .filter((s) => s.fullName.toLowerCase().includes(q))
      .slice(0, 20);
  }, [enrollableStudents, rosterIds, search]);

  const onAdd = useCallback(
    (studentId: number) => {
      if (!classId) return;
      setError(null);
      setNotice(null);
      startMutate(async () => {
        const res = await addStudentToClassAction(classId as number, studentId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setNotice(res.action === 'already' ? 'Học viên đã ở trong lớp.' : 'Đã thêm học viên vào lớp.');
        setSearch('');
        reload(classId as number);
      });
    },
    [classId, reload],
  );

  const onRemove = useCallback(
    (studentId: number, fullName: string) => {
      if (!classId) return;
      if (!window.confirm(`Rút "${fullName}" khỏi lớp? (giữ lịch sử ghi danh)`)) return;
      setError(null);
      setNotice(null);
      startMutate(async () => {
        const res = await removeStudentFromClassAction(classId as number, studentId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setNotice('Đã rút học viên khỏi lớp.');
        reload(classId as number);
      });
    },
    [classId, reload],
  );

  const onTransfer = useCallback(
    (studentId: number, fullName: string, toClassId: number) => {
      if (!classId || !toClassId) return;
      const target = classes.find((c) => c.id === toClassId);
      if (!window.confirm(`Chuyển "${fullName}" sang lớp "${target?.title ?? ''}"?`)) return;
      setError(null);
      setNotice(null);
      startMutate(async () => {
        const res = await transferStudentClassAction(classId as number, studentId, toClassId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setNotice('Đã chuyển học viên sang lớp mới.');
        reload(classId as number);
      });
    },
    [classId, classes, reload],
  );

  const toggleOne = useCallback((studentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }, []);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.studentId)),
    );
  }, [rows]);

  const summarize = useCallback((verb: string, succeeded: number, failedLen: number) => {
    setNotice(
      `Đã ${verb} ${succeeded} học viên` + (failedLen > 0 ? ` (${failedLen} lỗi/bỏ qua).` : '.'),
    );
  }, []);

  const onBulkRemove = useCallback(() => {
    if (!classId || selected.size === 0) return;
    const ids = Array.from(selected);
    if (!window.confirm(`Rút ${ids.length} học viên đã chọn khỏi lớp? (giữ lịch sử ghi danh)`)) return;
    setError(null);
    setNotice(null);
    startMutate(async () => {
      const res = await bulkRemoveStudentsFromClassAction(classId as number, ids);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      summarize('rút', res.succeeded, res.failed.length);
      reload(classId as number);
    });
  }, [classId, selected, reload, summarize]);

  const onBulkTransfer = useCallback(
    (toClassId: number) => {
      if (!classId || !toClassId || selected.size === 0) return;
      const ids = Array.from(selected);
      const target = classes.find((c) => c.id === toClassId);
      if (!window.confirm(`Chuyển ${ids.length} học viên đã chọn sang lớp "${target?.title ?? ''}"?`)) return;
      setError(null);
      setNotice(null);
      startMutate(async () => {
        const res = await bulkTransferStudentsClassAction(classId as number, ids, toClassId);
        if (!res.ok) {
          setError(res.message);
          return;
        }
        summarize('chuyển', res.succeeded, res.failed.length);
        reload(classId as number);
      });
    },
    [classId, selected, classes, reload, summarize],
  );

  const lowCount = rows.filter(
    (r) => typeof r.sessionsRemaining === 'number' && r.sessionsRemaining <= 3,
  ).length;
  const cap = selectedClass?.siSoToiDa ?? null;
  const busy = loading || mutating;

  return (
    <div>
      {error ? (
        <p role="alert" className="ds-error">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="ds-muted">
          ✓ {notice}
        </p>
      ) : null}

      <label className="ds-field">
        Lớp
        <select
          className="ds-select"
          value={classId}
          onChange={(e) => onPickClass(e.target.value)}
          disabled={busy}
        >
          <option value="">— Chọn lớp —</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
              {c.location ? ` (${c.location})` : ''}
            </option>
          ))}
        </select>
      </label>

      {loading ? <p className="ds-muted">Đang tải sĩ số…</p> : null}

      {picked && !loading ? (
        <>
          {selectedClass && (selectedClass.coach || selectedClass.troGiang) ? (
            <p className="ds-muted" style={{ marginTop: 8 }}>
              {selectedClass.coach ? (
                <>
                  GV phụ trách: <strong>{selectedClass.coach}</strong>
                </>
              ) : null}
              {selectedClass.coach && selectedClass.troGiang ? ' · ' : ''}
              {selectedClass.troGiang ? (
                <>
                  Trợ giảng: <strong>{selectedClass.troGiang}</strong>
                </>
              ) : null}
            </p>
          ) : null}
          <div style={{ margin: '16px 0' }}>
            <label className="ds-field">
              Thêm học viên vào lớp
              <input
                className="ds-input"
                type="search"
                placeholder="Gõ tên học viên…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={busy}
              />
            </label>
            {search.trim() ? (
              candidates.length > 0 ? (
                <ul
                  style={{
                    listStyle: 'none',
                    margin: '8px 0 0',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {candidates.map((s) => (
                    <li
                      key={s.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span>{s.fullName}</span>
                      <button
                        type="button"
                        className="ds-btn"
                        onClick={() => onAdd(s.id)}
                        disabled={busy}
                      >
                        + Thêm vào lớp
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ds-muted" style={{ marginTop: 8 }}>
                  Không có học viên phù hợp (đã ở trong lớp, hoặc ngoài phạm vi cơ sở của bạn).
                </p>
              )
            ) : null}
          </div>

          {rows.length === 0 ? (
            <p className="ds-muted">
              Lớp này chưa có học viên đang học (hoặc ngoài phạm vi cơ sở của bạn).
            </p>
          ) : (
            <>
              <p className="ds-muted" style={{ marginBottom: 12 }}>
                {rows.length}
                {cap ? `/${cap}` : ''} học viên đang học
                {cap && rows.length >= cap ? ' — ⚠ đã đủ/vượt sĩ số tối đa' : ''}
                {lowCount > 0 ? ` — ${lowCount} sắp hết buổi (≤ 3)` : ''}
              </p>

              {selected.size > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '8px 12px',
                    marginBottom: 12,
                    borderRadius: 6,
                    background: 'var(--theme-elevation-50)',
                  }}
                >
                  <strong>Đã chọn {selected.size}</strong>
                  <button
                    type="button"
                    className="ds-btn-outline"
                    onClick={onBulkRemove}
                    disabled={busy}
                  >
                    Rút khỏi lớp ({selected.size})
                  </button>
                  <select
                    className="ds-select"
                    value=""
                    disabled={busy || classes.length < 2}
                    aria-label="Chuyển các học viên đã chọn sang lớp khác"
                    onChange={(e) => {
                      const to = Number(e.target.value);
                      e.currentTarget.value = '';
                      if (to) onBulkTransfer(to);
                    }}
                  >
                    <option value="">Chuyển sang lớp… ({selected.size})</option>
                    {classes
                      .filter((c) => c.id !== classId)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    className="ds-btn-outline"
                    onClick={() => setSelected(new Set())}
                    disabled={busy}
                  >
                    Bỏ chọn
                  </button>
                </div>
              ) : null}

              <div className="ds-tbl-wrap">
                <table className="ds-tbl">
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          disabled={busy}
                          aria-label="Chọn tất cả học viên"
                        />
                      </th>
                      <th scope="col">Học viên</th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col">Buổi còn lại</th>
                      <th scope="col">SĐT phụ huynh</th>
                      <th scope="col">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const low =
                        typeof r.sessionsRemaining === 'number' && r.sessionsRemaining <= 3;
                      return (
                        <tr key={r.studentId}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selected.has(r.studentId)}
                              onChange={() => toggleOne(r.studentId)}
                              disabled={busy}
                              aria-label={`Chọn ${r.fullName}`}
                            />
                          </td>
                          <td>
                            <a href={`/admin/collections/students/${r.studentId}`}>{r.fullName}</a>
                          </td>
                          <td>
                            {r.enrollmentStatus
                              ? STATUS_LABELS[r.enrollmentStatus] ?? r.enrollmentStatus
                              : '—'}
                          </td>
                          <td className={'ds-tbl__num' + (low ? ' is-low' : '')}>
                            {typeof r.sessionsRemaining === 'number'
                              ? r.sessionsRemaining
                              : '— (chưa có chu kỳ)'}
                          </td>
                          <td>
                            {r.parentPhone ? (
                              <a href={`tel:${r.parentPhone}`}>{r.parentPhone}</a>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="ds-btn-outline"
                                onClick={() => onRemove(r.studentId, r.fullName)}
                                disabled={busy}
                              >
                                Rút khỏi lớp
                              </button>
                              <select
                                className="ds-select"
                                value=""
                                disabled={busy || classes.length < 2}
                                aria-label={`Chuyển ${r.fullName} sang lớp khác`}
                                onChange={(e) => {
                                  const to = Number(e.target.value);
                                  e.currentTarget.value = '';
                                  if (to) onTransfer(r.studentId, r.fullName, to);
                                }}
                              >
                                <option value="">Chuyển lớp…</option>
                                {classes
                                  .filter((c) => c.id !== classId)
                                  .map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.title}
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
