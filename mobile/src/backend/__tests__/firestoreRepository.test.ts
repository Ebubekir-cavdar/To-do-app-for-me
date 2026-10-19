/// <reference types="jest" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Task } from '../../model/task';
import { createFirestoreRepository } from '../firebase/firestoreRepository';

type Listener = { query: any; next: (snap: any) => void; error: (e: unknown) => void; unsubscribe: jest.Mock };
type Batch = { sets: { ref: any; data: any }[]; deletes: any[]; commit: jest.Mock };

jest.mock('@react-native-firebase/firestore', () => {
  let autoId = 0;
  const listeners: Listener[] = [];
  const batches: Batch[] = [];
  return {
    __listeners: listeners,
    __batches: batches,
    getFirestore: jest.fn(() => ({ kind: 'firestore' })),
    collection: jest.fn((_db: unknown, ...segments: string[]) => ({ kind: 'collection', path: segments.join('/') })),
    doc: jest.fn((col: { path: string }, id?: string) => {
      const docId = id ?? `auto${++autoId}`;
      return { kind: 'doc', id: docId, path: `${col.path}/${docId}` };
    }),
    where: jest.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    query: jest.fn((col: unknown, ...constraints: unknown[]) => ({ kind: 'query', col, constraints })),
    onSnapshot: jest.fn((q: unknown, next: any, error: any) => {
      const l: Listener = { query: q, next, error, unsubscribe: jest.fn() };
      listeners.push(l);
      return l.unsubscribe;
    }),
    // Simulates being offline: the server never acknowledges.
    setDoc: jest.fn(() => new Promise(() => {})),
    updateDoc: jest.fn(() => Promise.resolve()),
    deleteField: jest.fn(() => ({ kind: 'deleteField' })),
    deleteDoc: jest.fn(() => Promise.resolve()),
    writeBatch: jest.fn(() => {
      // Offline: the server never acknowledges the batch.
      const b: Batch = { sets: [], deletes: [], commit: jest.fn(() => new Promise(() => {})) };
      batches.push(b);
      return {
        set: jest.fn((ref: unknown, data: unknown) => { b.sets.push({ ref, data }); }),
        delete: jest.fn((ref: unknown) => { b.deletes.push(ref); }),
        commit: b.commit,
      };
    }),
    getDocsFromCache: jest.fn(() => Promise.resolve({ docs: [] })),
    // Offline: the server query never answers (removeSeries must time out and keep the cache result).
    getDocsFromServer: jest.fn(() => new Promise(() => {})),
  };
});

const fs = jest.requireMock('@react-native-firebase/firestore') as any;
const listeners: Listener[] = fs.__listeners;
const batches: Batch[] = fs.__batches;

const snap = (docs: { id: string; data: Record<string, unknown> }[]) => ({
  docs: docs.map((d) => ({ id: d.id, data: () => d.data })),
});

beforeEach(() => {
  listeners.length = 0;
  batches.length = 0;
  jest.clearAllMocks();
});

const series = (n: number, recurrenceId = 'r-1') =>
  Array.from({ length: n }, (_, i) => ({ title: 'Spor', date: `2026-11-${String(i + 1).padStart(2, '0')}`, time: '18:00', recurrenceId }));

const taskData = (date: string, recurrenceId: string | null, done = false) =>
  ({ title: 'Spor', date, time: null, done, createdAt: 1, categoryId: null, recurrenceId });

describe('createFirestoreRepository', () => {
  it('scopes everything to users/{uid}/tasks', () => {
    createFirestoreRepository('u1');
    expect(fs.collection).toHaveBeenCalledWith({ kind: 'firestore' }, 'users', 'u1', 'tasks');
  });

  it('subscribeRange builds a single-field date range query and maps docs', () => {
    const repo = createFirestoreRepository('u1');
    const cb = jest.fn();
    const unsub = repo.subscribeRange('2026-10-12', '2026-10-18', cb);

    expect(listeners).toHaveLength(1);
    expect(listeners[0].query.col.path).toBe('users/u1/tasks');
    expect(listeners[0].query.constraints).toEqual([
      { field: 'date', op: '>=', value: '2026-10-12' },
      { field: 'date', op: '<=', value: '2026-10-18' },
    ]);

    listeners[0].next(
      snap([
        { id: 'a', data: { title: 'Spor', date: '2026-10-17', time: '18:00', done: false, createdAt: 5, categoryId: null, recurrenceId: null } },
        { id: 'bad', data: { title: 'no date' } },
      ]),
    );
    expect(cb).toHaveBeenCalledWith([
      { id: 'a', title: 'Spor', date: '2026-10-17', time: '18:00', done: false, failed: false, createdAt: 5, categoryId: null, recurrenceId: null },
    ]);

    unsub();
    unsub(); // idempotent
    expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
    listeners[0].next(snap([]));
    expect(cb).toHaveBeenCalledTimes(1); // nothing delivered after unsubscribe
  });

  it('subscribeOpen queries only done == false', () => {
    createFirestoreRepository('u1').subscribeOpen(jest.fn());
    expect(listeners[0].query.constraints).toEqual([{ field: 'done', op: '==', value: false }]);
  });

  it('surfaces snapshot errors via console.warn', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    createFirestoreRepository('u1').subscribeOpen(jest.fn());
    const err = new Error('permission-denied');
    listeners[0].error(err);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('open tasks'), err);
    warn.mockRestore();
  });

  it('add() returns immediately with a client-generated id, even if the server never acks', async () => {
    const repo = createFirestoreRepository('u1');
    const task: Task = await repo.add({ title: ' Market ', date: '2026-10-17', time: null });

    expect(task.id).toBe(fs.doc.mock.results[0].value.id);
    expect(task).toMatchObject({ title: 'Market', date: '2026-10-17', time: null, done: false, failed: false, categoryId: null, recurrenceId: null });
    expect(typeof task.createdAt).toBe('number');
    expect(fs.doc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1/tasks' }));
    // Written without `failed` (absent = false), exactly like before the field existed.
    const { failed: _failed, ...doc } = task;
    expect(fs.setDoc).toHaveBeenCalledWith(expect.objectContaining({ path: `users/u1/tasks/${task.id}` }), doc);
  });

  it('add() rejects invalid input without writing', async () => {
    const repo = createFirestoreRepository('u1');
    await expect(repo.add({ title: '  ', date: '2026-10-17', time: null })).rejects.toThrow();
    expect(fs.setDoc).not.toHaveBeenCalled();
  });

  it('add() logs (does not throw) when the write is later rejected', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    fs.setDoc.mockImplementationOnce(() => Promise.reject(new Error('denied')));
    await createFirestoreRepository('u1').add({ title: 'a', date: '2026-10-17', time: null });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalledWith('[firestore] add failed', expect.any(Error));
    warn.mockRestore();
  });

  it('setDone and remove target the task document', async () => {
    const repo = createFirestoreRepository('u1');
    const DEL = { kind: 'deleteField' };
    // Done clears failed (field deleted) in the same update; undone leaves it alone.
    await repo.setDone('t1', true);
    expect(fs.updateDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'users/u1/tasks/t1' }), { done: true, failed: DEL });
    await repo.setDone('t1', false);
    expect(fs.updateDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'users/u1/tasks/t1' }), { done: false });
    expect(fs.updateDoc).toHaveBeenCalledTimes(2);
    await repo.remove('t2');
    expect(fs.deleteDoc).toHaveBeenCalledWith(expect.objectContaining({ path: 'users/u1/tasks/t2' }));
  });

  it('setFailed: one atomic update — failing also un-does; un-failing deletes the field', async () => {
    const repo = createFirestoreRepository('u1');
    await repo.setFailed('t1', true);
    expect(fs.updateDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'users/u1/tasks/t1' }), { failed: true, done: false });
    await repo.setFailed('t1', false);
    expect(fs.updateDoc).toHaveBeenLastCalledWith(expect.objectContaining({ path: 'users/u1/tasks/t1' }), { failed: { kind: 'deleteField' } });
    expect(fs.updateDoc).toHaveBeenCalledTimes(2);
  });

  it('add() persists recurrenceId and rejects a malformed one', async () => {
    const repo = createFirestoreRepository('u1');
    const t = await repo.add({ title: 'Spor', date: '2026-10-20', time: null, recurrenceId: 'r-abc' });
    expect(t.recurrenceId).toBe('r-abc');
    expect(fs.setDoc).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ recurrenceId: 'r-abc' }));

    expect((await repo.add({ title: 'a', date: '2026-10-20', time: null, recurrenceId: null })).recurrenceId).toBeNull();
    await expect(repo.add({ title: 'a', date: '2026-10-20', time: null, recurrenceId: 42 as any })).rejects.toThrow();
    await expect(repo.add({ title: 'a', date: '2026-10-20', time: null, recurrenceId: '' })).rejects.toThrow();
    expect(fs.setDoc).toHaveBeenCalledTimes(2);
  });

  describe('shared listeners and identity', () => {
    const doc = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      data: { title: 'T ' + id, date: '2026-10-17', time: null, done: false, createdAt: 1, categoryId: null, recurrenceId: null, ...over },
    });

    it('subscribers of the same query share one listener; it closes when the last one leaves', () => {
      const repo = createFirestoreRepository('u1');
      const a = jest.fn();
      const b = jest.fn();
      const offA = repo.subscribeOpen(a);
      const offB = repo.subscribeOpen(b);
      const offR1 = repo.subscribeRange('2026-10-12', '2026-10-18', jest.fn());
      const offR2 = repo.subscribeRange('2026-10-12', '2026-10-18', jest.fn());
      const offR3 = repo.subscribeRange('2026-10-19', '2026-10-25', jest.fn());
      expect(listeners).toHaveLength(3); // open, one range, another range

      listeners[0].next(snap([doc('x')]));
      expect(a).toHaveBeenCalledTimes(1);
      expect(b.mock.calls[0][0]).toBe(a.mock.calls[0][0]); // same array for both

      offA();
      expect(listeners[0].unsubscribe).not.toHaveBeenCalled();
      offB();
      expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
      offR1();
      offR2();
      offR3();
      expect(listeners.every((l) => l.unsubscribe.mock.calls.length === 1)).toBe(true);
    });

    it('a subscriber joining a live listener gets its current tasks at once', () => {
      const repo = createFirestoreRepository('u1');
      repo.subscribeOpen(jest.fn());
      listeners[0].next(snap([doc('x')]));
      const late = jest.fn();
      repo.subscribeOpen(late);
      expect(listeners).toHaveLength(1);
      expect(late).toHaveBeenCalledTimes(1);
      expect(late.mock.calls[0][0].map((t: Task) => t.id)).toEqual(['x']);
    });

    it('keeps unchanged Task objects, replaces only the changed one, and skips no-op snapshots', () => {
      const repo = createFirestoreRepository('u1');
      const cb = jest.fn();
      repo.subscribeRange('2026-10-12', '2026-10-18', cb);
      listeners[0].next(snap([doc('a'), doc('b'), doc('c')]));
      const [first] = cb.mock.calls[0] as [Task[]];

      // Same data again (e.g. a re-sent snapshot): not delivered.
      listeners[0].next(snap([doc('a'), doc('b'), doc('c')]));
      expect(cb).toHaveBeenCalledTimes(1);

      listeners[0].next(snap([doc('a'), doc('b', { done: true }), doc('c')]));
      expect(cb).toHaveBeenCalledTimes(2);
      const [second] = cb.mock.calls[1] as [Task[]];
      expect(second).not.toBe(first);
      expect(second[0]).toBe(first[0]);
      expect(second[1]).not.toBe(first[1]);
      expect(second[1]).toEqual({ ...first[1], done: true });
      expect(second[2]).toBe(first[2]);

      // Removal and reorder are changes too.
      listeners[0].next(snap([doc('a'), doc('c')]));
      expect(cb.mock.calls[2][0]).toEqual([second[0], second[2]]);
      expect(cb.mock.calls[2][0][1]).toBe(first[2]);
    });

    it('the same unchanged task is the same object in every listener', () => {
      const repo = createFirestoreRepository('u1');
      const range = jest.fn();
      const open = jest.fn();
      repo.subscribeRange('2026-10-12', '2026-10-18', range);
      repo.subscribeOpen(open);
      listeners[0].next(snap([doc('a'), doc('b')]));
      listeners[1].next(snap([doc('b'), doc('z', { date: '2026-11-01' })]));
      expect(open.mock.calls[0][0][0]).toBe(range.mock.calls[0][0][1]);
    });

    it('a changed task is the same object in every listener, whichever echoes first', () => {
      const repo = createFirestoreRepository('u1');
      const range = jest.fn();
      const open = jest.fn();
      repo.subscribeRange('2026-10-12', '2026-10-18', range);
      repo.subscribeOpen(open);
      // b is done; the range listener holds it, the open one does not.
      listeners[0].next(snap([doc('a'), doc('b', { done: true })]));
      listeners[1].next(snap([doc('a')]));
      const doneB = range.mock.calls[0][0][1];

      // Undone: the open listener echoes first and maps the new content, then the range listener.
      listeners[1].next(snap([doc('a'), doc('b')]));
      listeners[0].next(snap([doc('a'), doc('b')]));
      const openB = open.mock.calls[1][0][1];
      const rangeB = range.mock.calls[1][0][1];
      expect(rangeB).not.toBe(doneB);
      expect(rangeB.done).toBe(false);
      expect(rangeB).toBe(openB);

      // A different change does not borrow another listener's object.
      listeners[0].next(snap([doc('a'), doc('b', { title: 'renamed' })]));
      expect(range.mock.calls[2][0][1]).not.toBe(openB);
      expect(range.mock.calls[2][0][1].title).toBe('renamed');
    });

    it('after a listener error, a new subscriber gets a fresh listener', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const repo = createFirestoreRepository('u1');
      const off = repo.subscribeOpen(jest.fn());
      listeners[0].error(new Error('unavailable'));
      const late = jest.fn();
      repo.subscribeOpen(late);
      expect(listeners).toHaveLength(2);
      listeners[1].next(snap([doc('x')]));
      expect(late).toHaveBeenCalledTimes(1);
      off();
      expect(listeners[0].unsubscribe).toHaveBeenCalledTimes(1);
      expect(listeners[1].unsubscribe).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('repositories (users) never share listeners', () => {
      createFirestoreRepository('u1').subscribeOpen(jest.fn());
      createFirestoreRepository('u2').subscribeOpen(jest.fn());
      expect(listeners.map((l) => l.query.col.path)).toEqual(['users/u1/tasks', 'users/u2/tasks']);
    });
  });

  describe('addMany', () => {
    it('writes one batch with unique client ids, shared recurrenceId, and returns without waiting for commit', async () => {
      const repo = createFirestoreRepository('u1');
      // commit() never resolves (offline) — addMany must still resolve.
      const tasks = await repo.addMany(series(9));

      expect(tasks).toHaveLength(9);
      expect(new Set(tasks.map((t) => t.id)).size).toBe(9);
      expect(tasks.every((t) => t.recurrenceId === 'r-1' && t.title === 'Spor' && !t.done)).toBe(true);
      expect(tasks.map((t) => t.date)).toEqual(series(9).map((s) => s.date));

      // One batch, committed once: the native SDK applies it to the cache in one step, so every
      // listener sees all tasks in a single snapshot.
      expect(fs.writeBatch).toHaveBeenCalledTimes(1);
      expect(fs.writeBatch).toHaveBeenCalledWith({ kind: 'firestore' });
      expect(batches[0].commit).toHaveBeenCalledTimes(1);
      expect(batches[0].sets.map((w) => w.ref.path)).toEqual(tasks.map((t) => `users/u1/tasks/${t.id}`));
      expect(batches[0].sets.map((w) => w.data)).toEqual(tasks.map(({ failed: _f, ...doc }) => doc));
      expect(tasks.every((t) => t.failed === false)).toBe(true);
      expect(fs.setDoc).not.toHaveBeenCalled();
    });

    it('rejects the whole call and writes nothing if any input is invalid', async () => {
      const repo = createFirestoreRepository('u1');
      const inputs = series(5);
      inputs[3] = { ...inputs[3], date: '2026-13-01' };
      await expect(repo.addMany(inputs)).rejects.toThrow();
      await expect(repo.addMany([...series(2), { title: '   ', date: '2026-11-05', time: null, recurrenceId: 'r-1' }])).rejects.toThrow();
      await expect(repo.addMany([...series(2), { title: 'x', date: '2026-11-05', time: null, recurrenceId: 7 as any }])).rejects.toThrow();
      expect(fs.writeBatch).not.toHaveBeenCalled();
      expect(fs.setDoc).not.toHaveBeenCalled();
    });

    it('accepts 200 inputs and rejects 201', async () => {
      const repo = createFirestoreRepository('u1');
      const many = (n: number) => Array.from({ length: n }, () => ({ title: 'x', date: '2026-11-01', time: null, recurrenceId: 'r-1' }));
      await expect(repo.addMany(many(201))).rejects.toThrow();
      expect(fs.writeBatch).not.toHaveBeenCalled();
      expect(await repo.addMany(many(200))).toHaveLength(200);
      expect(batches[0].sets).toHaveLength(200);
    });

    it('does nothing for an empty list', async () => {
      expect(await createFirestoreRepository('u1').addMany([])).toEqual([]);
      expect(fs.writeBatch).not.toHaveBeenCalled();
    });

    it('logs (does not throw) when the batch commit is later rejected', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fs.writeBatch.mockImplementationOnce(() => ({ set: jest.fn(), delete: jest.fn(), commit: () => Promise.reject(new Error('denied')) }));
      await createFirestoreRepository('u1').addMany(series(2));
      await new Promise((r) => setTimeout(r, 0));
      expect(warn).toHaveBeenCalledWith('[firestore] addMany failed', expect.any(Error));
      warn.mockRestore();
    });
  });

  describe('removeSeries', () => {
    const cached = () =>
      snap([
        { id: 'past', data: taskData('2026-10-13', 'r-1') },
        { id: 'pastDone', data: taskData('2026-10-15', 'r-1', true) },
        { id: 'from', data: taskData('2026-10-20', 'r-1') },
        { id: 'futureDone', data: taskData('2026-10-22', 'r-1', true) },
        { id: 'future', data: taskData('2026-11-03', 'r-1') },
      ]);

    it('uses a single-field recurrenceId query and deletes only dates >= from (done or not) in one batch', async () => {
      fs.getDocsFromCache.mockResolvedValueOnce(cached());
      const repo = createFirestoreRepository('u1', undefined, { serverSweepTimeoutMs: 10 });

      // Server never answers (offline) and the batch never commits — still resolves from the cache.
      const count = await repo.removeSeries('r-1', '2026-10-20');

      expect(count).toBe(3);
      const q = fs.getDocsFromCache.mock.calls[0][0];
      expect(q.col.path).toBe('users/u1/tasks');
      expect(q.constraints).toEqual([{ field: 'recurrenceId', op: '==', value: 'r-1' }]);
      expect(batches).toHaveLength(1);
      expect(batches[0].deletes.map((r) => r.id)).toEqual(['from', 'futureDone', 'future']);
      expect(batches[0].commit).toHaveBeenCalledTimes(1);
      expect(fs.deleteDoc).not.toHaveBeenCalled();
    });

    it('also deletes series tasks only the server knows, without deleting twice', async () => {
      fs.getDocsFromCache.mockResolvedValueOnce(cached());
      fs.getDocsFromServer.mockResolvedValueOnce(
        snap([
          { id: 'from', data: taskData('2026-10-20', 'r-1') },
          { id: 'remoteDone', data: taskData('2026-10-27', 'r-1', true) },
          { id: 'remotePast', data: taskData('2026-10-01', 'r-1', true) },
        ]),
      );
      const count = await createFirestoreRepository('u1').removeSeries('r-1', '2026-10-20');

      expect(count).toBe(4);
      expect(batches).toHaveLength(2);
      expect(batches[1].deletes.map((r) => r.id)).toEqual(['remoteDone']);
    });

    it('leaves other series and non-series tasks untouched', async () => {
      fs.getDocsFromCache.mockResolvedValueOnce(
        snap([
          { id: 'mine', data: taskData('2026-10-21', 'r-1') },
          // Not expected from the query, but filtered defensively anyway.
          { id: 'other', data: taskData('2026-10-21', 'r-2') },
          { id: 'single', data: taskData('2026-10-21', null) },
        ]),
      );
      const count = await createFirestoreRepository('u1', undefined, { serverSweepTimeoutMs: 10 }).removeSeries('r-1', '2026-10-20');
      expect(count).toBe(1);
      expect(batches[0].deletes.map((r) => r.id)).toEqual(['mine']);
    });

    it('works offline when the server query rejects', async () => {
      fs.getDocsFromCache.mockResolvedValueOnce(cached());
      fs.getDocsFromServer.mockRejectedValueOnce(Object.assign(new Error('unavailable'), { code: 'firestore/unavailable' }));
      expect(await createFirestoreRepository('u1').removeSeries('r-1', '2026-10-21')).toBe(2);
    });

    it('still uses the server result if the cache query fails', async () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      fs.getDocsFromCache.mockRejectedValueOnce(new Error('cache broken'));
      fs.getDocsFromServer.mockResolvedValueOnce(cached());
      expect(await createFirestoreRepository('u1').removeSeries('r-1', '2026-10-20')).toBe(3);
      expect(warn).toHaveBeenCalledWith('[firestore] removeSeries cache query failed', expect.any(Error));
      warn.mockRestore();
    });

    it('splits more than 500 deletes into several batches', async () => {
      const docs = Array.from({ length: 1201 }, (_, i) => ({ id: `t${i}`, data: taskData('2026-12-01', 'r-1') }));
      fs.getDocsFromCache.mockResolvedValueOnce(snap(docs));
      const count = await createFirestoreRepository('u1', undefined, { serverSweepTimeoutMs: 10 }).removeSeries('r-1', '2026-10-20');
      expect(count).toBe(1201);
      expect(batches.map((b) => b.deletes.length)).toEqual([500, 500, 201]);
    });

    it('returns 0 and writes nothing when nothing matches', async () => {
      const count = await createFirestoreRepository('u1', undefined, { serverSweepTimeoutMs: 10 }).removeSeries('r-9', '2026-10-20');
      expect(count).toBe(0);
      expect(fs.writeBatch).not.toHaveBeenCalled();
    });

    it('rejects invalid arguments without querying', async () => {
      const repo = createFirestoreRepository('u1');
      await expect(repo.removeSeries('', '2026-10-20')).rejects.toThrow();
      await expect(repo.removeSeries('r-1', '20.10.2026')).rejects.toThrow();
      expect(fs.getDocsFromCache).not.toHaveBeenCalled();
    });
  });
});
