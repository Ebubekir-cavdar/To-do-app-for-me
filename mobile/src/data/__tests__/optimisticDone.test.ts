/// <reference types="jest" />
/**
 * The optimistic status overlay (done / failed) over a repository whose snapshots and write results the test
 * delivers by hand (like RNFirebase, where both arrive later over the bridge).
 */
import type { Task } from '../../model/task';
import { withOptimisticDone } from '../optimisticDone';
import type { TaskRepository } from '../types';

type Deferred = { resolve: () => void; reject: (e: unknown) => void };

function fakeRepo() {
  const range = new Set<(t: Task[]) => void>();
  const open = new Set<(t: Task[]) => void>();
  const writes: { id: string; op: 'done' | 'failed'; value: boolean; d: Deferred }[] = [];
  const repo: TaskRepository = {
    subscribeRange: (_f, _t, cb) => { range.add(cb); return () => { range.delete(cb); }; },
    subscribeOpen: (cb) => { open.add(cb); return () => { open.delete(cb); }; },
    add: jest.fn(),
    addMany: jest.fn(),
    remove: jest.fn(),
    removeSeries: jest.fn(),
    setDone: (id, done) =>
      new Promise<void>((resolve, reject) => { writes.push({ id, op: 'done', value: done, d: { resolve, reject } }); }),
    setFailed: (id, failed) =>
      new Promise<void>((resolve, reject) => { writes.push({ id, op: 'failed', value: failed, d: { resolve, reject } }); }),
  };
  return {
    repo,
    writes,
    /** A snapshot of the range query and of the open query (derived from `all`, like Firestore). */
    push(all: Task[]) {
      range.forEach((cb) => cb(all));
      const o = all.filter((t) => !t.done).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      open.forEach((cb) => cb(o));
    },
    pushRange: (all: Task[]) => range.forEach((cb) => cb(all)),
    pushOpen: (o: Task[]) => open.forEach((cb) => cb(o)),
  };
}

const task = (id: string, done = false, extra: Partial<Task> = {}): Task => ({
  id, title: id, date: '2030-01-01', time: null, done, failed: false, createdAt: 1, categoryId: null, recurrenceId: null, ...extra,
});

function setup(initial: Task[]) {
  const f = fakeRepo();
  const o = withOptimisticDone(f.repo);
  const rangeSeen: Task[][] = [];
  const openSeen: Task[][] = [];
  o.subscribeRange('2030-01-01', '2030-01-07', (t) => rangeSeen.push(t));
  o.subscribeOpen((t) => openSeen.push(t));
  f.push(initial);
  const last = () => ({ range: rangeSeen[rangeSeen.length - 1], open: openSeen[openSeen.length - 1] });
  return { f, o, rangeSeen, openSeen, last };
}

const flush = () => new Promise<void>((r) => setImmediate(r));
const ids = (l: Task[]) => l.map((t) => t.id);

it('passes the repository arrays through untouched while nothing is pending', () => {
  const a = [task('a'), task('b', true)];
  const { last } = setup(a);
  expect(last().range).toBe(a);
  expect(ids(last().open)).toEqual(['a']);
});

it('shows a toggle synchronously everywhere; untouched tasks keep their objects', () => {
  const a = task('a'), b = task('b'), c = task('c');
  const { f, o, last, rangeSeen, openSeen } = setup([a, b, c]);
  const before = last();
  o.setDone('b', true).catch(() => {});

  // Same tick, no snapshot yet.
  expect(f.writes).toHaveLength(1);
  expect(rangeSeen).toHaveLength(2);
  expect(openSeen).toHaveLength(2);
  const now = last();
  expect(now.range).not.toBe(before.range);
  expect(now.range[0]).toBe(a);
  expect(now.range[2]).toBe(c);
  expect(now.range[1]).not.toBe(b);
  expect(now.range[1]).toEqual({ ...b, done: true });
  expect(ids(now.open)).toEqual(['a', 'c']);
  expect(now.open[0]).toBe(a);
  expect(now.open[1]).toBe(c);
});

it('a later subscriber of the same query gets the overlaid array too', () => {
  const { o, last } = setup([task('a'), task('b')]);
  o.setDone('a', true).catch(() => {});
  let late: Task[] | null = null;
  o.subscribeRange('2030-01-01', '2030-01-07', (t) => { late = t; });
  expect(late).toBe(last().range);
});

it('confirmation clears the overlay without re-emitting, and later changes flow through', async () => {
  const a = task('a'), b = task('b');
  const { f, o, last, rangeSeen, openSeen } = setup([a, b]);
  const p = o.setDone('a', true);
  const shown = last().range[0];
  const counts = [rangeSeen.length, openSeen.length];

  // Firestore's local-write snapshot: a new object with the new value.
  const a2 = task('a', true);
  f.push([a2, b]);
  expect(o.pendingCount).toBe(0);
  expect([rangeSeen.length, openSeen.length]).toEqual(counts); // nothing new to render
  expect(last().range[0]).toBe(shown);

  // The repository keeps reusing a2: still the on-screen object, no emission.
  f.pushRange([a2, b, task('c')]);
  expect(last().range[0]).toBe(shown);
  expect(last().range[1]).toBe(b);

  f.writes[0].d.resolve();
  await expect(p).resolves.toBeUndefined();
  expect(o.pendingCount).toBe(0);

  // A real change replaces it.
  const a3 = task('a', true, { title: 'renamed' });
  f.pushRange([a3, b]);
  expect(last().range[0]).toBe(a3);
});

it('ignores a stale snapshot (pre-tap object) instead of flickering back', () => {
  const a = task('a'), b = task('b');
  const { f, o, last } = setup([a, b]);
  o.setDone('a', true).catch(() => {});
  f.push([a, b]); // produced before the write
  expect(o.pendingCount).toBe(1);
  expect(last().range[0].done).toBe(true);
  expect(ids(last().open)).toEqual(['b']);
});

it('reverts when the write fails, and still rejects for the caller to report', async () => {
  const a = task('a'), b = task('b');
  const { f, o, last } = setup([a, b]);
  const before = last();
  const p = o.setDone('a', true);
  expect(last().range[0].done).toBe(true);
  const err = new Error('permission-denied');
  f.writes[0].d.reject(err);
  await expect(p).rejects.toBe(err);
  expect(o.pendingCount).toBe(0);
  expect(last().range).toBe(before.range);
  expect(last().range[0]).toBe(a);
  expect(ids(last().open)).toEqual(['a', 'b']);
});

it('a write that throws synchronously reverts too', async () => {
  const f = fakeRepo();
  f.repo.setDone = () => { throw new Error('boom'); };
  const o = withOptimisticDone(f.repo);
  let seen: Task[] = [];
  o.subscribeRange('x', 'y', (t) => { seen = t; });
  const a = task('a');
  f.pushRange([a]);
  await expect(o.setDone('a', true)).rejects.toThrow('boom');
  expect(seen[0]).toBe(a);
  expect(o.pendingCount).toBe(0);
});

it('rapid double tap ends in the last intended state, through every echo', async () => {
  const a = task('a'), b = task('b');
  const { f, o, last } = setup([a, b]);
  const p1 = o.setDone('a', true);
  const p2 = o.setDone('a', false);
  expect(last().range[0]).toBe(a); // back to the repository's own object
  expect(ids(last().open)).toEqual(['a', 'b']);

  // Echo of the first write: must not flash "done".
  f.push([task('a', true), b]);
  expect(last().range[0].done).toBe(false);
  expect(ids(last().open)).toEqual(['a', 'b']);
  expect(o.pendingCount).toBe(1);

  // The first write failing does not revert the newer intent.
  f.writes[0].d.reject(new Error('late'));
  await expect(p1).rejects.toThrow('late');
  expect(last().range[0].done).toBe(false);

  // Echo of the second write confirms.
  f.push([task('a', false), b]);
  expect(o.pendingCount).toBe(0);
  expect(last().range[0].done).toBe(false);
  f.writes[1].d.resolve();
  await p2;
  expect(last().range[0].done).toBe(false);
});

it('double tap whose echoes were coalesced away is cleared by the acknowledgement', async () => {
  const a = task('a');
  const { f, o, last, rangeSeen } = setup([a]);
  const p1 = o.setDone('a', true);
  const p2 = o.setDone('a', false);
  const n = rangeSeen.length;
  f.writes[0].d.resolve();
  f.writes[1].d.resolve();
  await Promise.all([p1, p2]);
  expect(o.pendingCount).toBe(0);
  expect(last().range[0]).toBe(a);
  expect(rangeSeen.length).toBe(n);
});

it('an acknowledgement that beats its snapshot keeps the overlay until the next snapshot', async () => {
  const a = task('a');
  const { f, o, last } = setup([a]);
  const p = o.setDone('a', true);
  f.writes[0].d.resolve();
  await p;
  expect(o.pendingCount).toBe(1);
  expect(last().range[0].done).toBe(true);
  f.push([task('a', true)]);
  expect(o.pendingCount).toBe(0);
  expect(last().range[0].done).toBe(true);
});

it('undo puts the task back into the open list (document-id order) and the echo changes nothing', () => {
  const a = task('a'), c = task('c'), b = task('b', true);
  const { f, o, last, openSeen } = setup([a, b, c]);
  expect(ids(last().open)).toEqual(['a', 'c']);
  o.setDone('b', false).catch(() => {});
  const shown = last().range[1];
  expect(shown.done).toBe(false);
  expect(ids(last().open)).toEqual(['a', 'b', 'c']);
  expect(last().open[1]).toBe(shown); // the same object in both lists
  const n = openSeen.length;

  // Echo: the open query now returns b as a new object, the range query another new one.
  f.pushOpen([a, task('b'), c]);
  f.pushRange([a, task('b'), c]);
  expect(openSeen.length).toBe(n);
  expect(last().open[1]).toBe(shown);
  expect(last().range[1]).toBe(shown);
  expect(o.pendingCount).toBe(0);
});

it('applies a pending toggle to a query subscribed after the tap', () => {
  const f = fakeRepo();
  const o = withOptimisticDone(f.repo);
  o.subscribeRange('w1', 'w1', () => {});
  f.pushRange([task('a')]);
  o.setDone('a', true).catch(() => {});
  let next: Task[] = [];
  o.subscribeRange('w2', 'w2', (t) => { next = t; });
  f.pushRange([task('a')]); // a stale object arrives for both ranges
  expect(next[0].done).toBe(true);
});

it('releases the repository subscriptions when the last subscriber leaves', () => {
  const f = fakeRepo();
  const o = withOptimisticDone(f.repo);
  const spy = jest.spyOn(f.repo, 'subscribeOpen');
  const off1 = o.subscribeOpen(() => {});
  const off2 = o.subscribeOpen(() => {});
  expect(spy).toHaveBeenCalledTimes(1);
  off1();
  off2();
  // Resubscribing starts a new underlying subscription.
  o.subscribeOpen(() => {});
  expect(spy).toHaveBeenCalledTimes(2);
});

it('passes the other writes straight through', async () => {
  const f = fakeRepo();
  const o = withOptimisticDone(f.repo);
  o.add({ title: 't', date: '2030-01-01', time: null });
  o.addMany([]);
  o.remove('x');
  o.removeSeries('r', '2030-01-01');
  expect(f.repo.add).toHaveBeenCalledWith({ title: 't', date: '2030-01-01', time: null });
  expect(f.repo.addMany).toHaveBeenCalledWith([]);
  expect(f.repo.remove).toHaveBeenCalledWith('x');
  expect(f.repo.removeSeries).toHaveBeenCalledWith('r', '2030-01-01');
  await flush();
});

describe('setFailed', () => {
  const failedTask = (id: string, extra: Partial<Task> = {}) => task(id, false, { failed: true, ...extra });

  it('shows a fail synchronously everywhere; the task stays open (same object in both lists)', () => {
    const a = task('a'), b = task('b'), c = task('c');
    const { f, o, last } = setup([a, b, c]);
    const before = last();
    o.setFailed('b', true).catch(() => {});
    expect(f.writes).toEqual([expect.objectContaining({ id: 'b', op: 'failed', value: true })]);
    const now = last();
    expect(now.range).not.toBe(before.range);
    expect(now.range[0]).toBe(a);
    expect(now.range[2]).toBe(c);
    expect(now.range[1]).toEqual({ ...b, failed: true });
    expect(ids(now.open)).toEqual(['a', 'b', 'c']);
    expect(now.open[1]).toBe(now.range[1]);
    expect(now.open[0]).toBe(a);
  });

  it('the echo confirms without re-rendering; failure of a later write reverts to the repository value', async () => {
    const a = task('a');
    const { f, o, last, rangeSeen, openSeen } = setup([a]);
    const p = o.setFailed('a', true);
    const shown = last().range[0];
    const counts = [rangeSeen.length, openSeen.length];
    const a2 = failedTask('a');
    f.push([a2]);
    expect(o.pendingCount).toBe(0);
    expect([rangeSeen.length, openSeen.length]).toEqual(counts);
    expect(last().range[0]).toBe(shown);
    expect(last().open[0]).toBe(shown);
    f.writes[0].d.resolve();
    await p;

    // Un-fail, rejected by the server: back to the repository's failed task.
    const p2 = o.setFailed('a', false);
    expect(last().range[0].failed).toBe(false);
    f.writes[1].d.reject(new Error('permission-denied'));
    await expect(p2).rejects.toThrow('permission-denied');
    expect(o.pendingCount).toBe(0);
    expect(last().range[0]).toBe(shown);
  });

  it('reverts when the write fails', async () => {
    const a = task('a');
    const { f, o, last } = setup([a]);
    const p = o.setFailed('a', true);
    expect(last().range[0].failed).toBe(true);
    f.writes[0].d.reject(new Error('offline?'));
    await expect(p).rejects.toThrow('offline?');
    expect(last().range[0]).toBe(a);
    expect(last().open[0]).toBe(a);
  });

  it('checking a failed task marks it done and clears failed, in one step (open list drops it)', () => {
    const a = failedTask('a'), b = task('b');
    const { f, o, last } = setup([a, b]);
    o.setDone('a', true).catch(() => {});
    expect(f.writes).toEqual([expect.objectContaining({ id: 'a', op: 'done', value: true })]);
    expect(last().range[0]).toEqual({ ...a, done: true, failed: false });
    expect(ids(last().open)).toEqual(['b']);
    // The repository's echo (done, failed cleared) confirms.
    f.push([task('a', true), b]);
    expect(o.pendingCount).toBe(0);
    expect(last().range[0]).toEqual({ ...a, done: true, failed: false });
  });

  it('fail then quick un-fail ends not failed through both echoes', async () => {
    const a = task('a');
    const { f, o, last } = setup([a]);
    const p1 = o.setFailed('a', true);
    const p2 = o.setFailed('a', false);
    expect(last().range[0]).toBe(a);
    f.push([failedTask('a')]); // echo of the first write: must not flash "failed"
    expect(last().range[0].failed).toBe(false);
    expect(last().open[0].failed).toBe(false);
    expect(o.pendingCount).toBe(1);
    f.push([task('a')]); // echo of the second
    expect(o.pendingCount).toBe(0);
    expect(last().range[0].failed).toBe(false);
    f.writes[0].d.resolve();
    f.writes[1].d.resolve();
    await Promise.all([p1, p2]);
    expect(last().range[0].failed).toBe(false);
  });

  it('fail then quick check ends done and not failed, without flashing the fail echo', () => {
    const a = task('a'), b = task('b');
    const { f, o, last } = setup([a, b]);
    o.setFailed('a', true).catch(() => {});
    o.setDone('a', true).catch(() => {});
    expect(last().range[0]).toEqual({ ...a, done: true, failed: false });
    expect(ids(last().open)).toEqual(['b']);
    f.push([failedTask('a'), b]);
    expect(last().range[0]).toMatchObject({ done: true, failed: false });
    expect(ids(last().open)).toEqual(['b']);
    f.push([task('a', true), b]);
    expect(o.pendingCount).toBe(0);
  });

  it('failing a done task (repository contract: done=false too) puts it back into the open list', () => {
    const a = task('a'), b = task('b', true), c = task('c');
    const { o, last } = setup([a, b, c]);
    expect(ids(last().open)).toEqual(['a', 'c']);
    o.setFailed('b', true).catch(() => {});
    expect(last().range[1]).toEqual({ ...b, done: false, failed: true });
    expect(ids(last().open)).toEqual(['a', 'b', 'c']);
    expect(last().open[1]).toBe(last().range[1]);
  });

  it('un-failing changes nothing in the open list but the task object', () => {
    const a = failedTask('a'), c = task('c');
    const { f, o, last, openSeen } = setup([a, c]);
    o.setFailed('a', false).catch(() => {});
    const shown = last().range[0];
    expect(shown).toEqual({ ...a, failed: false });
    expect(last().open[0]).toBe(shown);
    expect(last().open[1]).toBe(c);
    const n = openSeen.length;
    f.pushOpen([task('a'), c]);
    f.pushRange([task('a'), c]);
    expect(openSeen.length).toBe(n);
    expect(last().range[0]).toBe(shown);
    expect(o.pendingCount).toBe(0);
  });
});
