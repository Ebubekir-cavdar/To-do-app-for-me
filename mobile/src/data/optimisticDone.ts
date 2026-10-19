/**
 * Optimistic status overlay over a TaskRepository: a checkbox tap (setDone) or a long-press
 * (setFailed) shows its new state in the very same render as the gesture, instead of waiting for
 * the repository's own snapshot (with RNFirebase the local-write snapshot still crosses the native
 * bridge, ~50–150 ms later).
 *
 * - Each write is a `Patch` of the status fields: setDone(true) → {done: true, failed: false},
 *   setDone(false) → {done: false}, setFailed(true) → {failed: true, done: false},
 *   setFailed(false) → {failed: false} — exactly what the repository writes atomically.
 * - The write records its patch (`pending`, by task id) and re-emits every live subscription at
 *   once: range lists show the task with the patch applied, the open list (a Firestore
 *   `done == false` query: failed tasks stay in it) drops it (done) or gets it back (not done,
 *   inserted in document-id order like the query). Every subscriber of a query gets the same
 *   array, as with the repositories' own sharing.
 * - Identity: only the written task gets a new object (one per repository object and status,
 *   shared by every list); all other tasks and unchanged arrays keep theirs. When the repository's
 *   snapshot then confirms the value, its new Task object is aliased to the one already on screen
 *   (same content), so the confirmation re-renders nothing.
 * - A write is confirmed when a snapshot shows the patched value as a new repository object (a
 *   stale snapshot still carrying the pre-write object does not count) or when it is acknowledged.
 *   From then on each query keeps the overlay only until its own next snapshot (the range and the
 *   open listener echo separately, so neither list flashes back meanwhile), and the entry is
 *   dropped as soon as no list needs it any more. A failed write drops it at once, which reverts
 *   the UI to the repository's value. A newer write on the same task supersedes the older one
 *   (only the latest write's outcome counts) and its patch is laid over the older one, so rapid
 *   taps / long-presses end in the last intended state.
 * - One overlay per repository (DataProvider keys it by repository), so a user change starts
 *   from an empty one.
 */
import { createSubscriptionHub, sameElements } from '../backend/sharedSubscriptions';
import { sameTask } from '../backend/firebase/taskDoc';
import type { Task } from '../model/task';
import type { TaskRepository } from './types';

/** The status fields a write sets (absent = left as the repository has it). */
type Patch = { done?: boolean; failed?: boolean };

interface Pending {
  patch: Patch;
  /** Write order; only the latest write of a task may settle its entry. */
  seq: number;
  /** The repository's object for the task when the write was issued (undefined if not loaded). */
  from: Task | undefined;
  /**
   * Set once confirmed: each source's snapshot count at that moment. The overlay then applies
   * only to sources that have not received a snapshot since (and to none that started later).
   */
  confirmedAt: Map<Source, number> | null;
}

interface Source {
  /** The open-tasks query (membership depends on `done`), else a date range. */
  open: boolean;
  /** Latest array from the repository. */
  base: Task[] | null;
  /** Latest array emitted to subscribers. */
  out: Task[] | null;
  /** Number of repository snapshots received. */
  version: number;
  emit: (v: Task[]) => void;
}

export interface OptimisticRepository extends TaskRepository {
  /** Number of optimistic entries still in effect (for tests). */
  readonly pendingCount: number;
}

/** True when `t` already has every value of `p`. */
function matches(t: Task, p: Patch): boolean {
  return (p.done === undefined || t.done === p.done) && (p.failed === undefined || t.failed === p.failed);
}

/** Index of a (done, failed) status, to cache one patched object per status. */
const statusKey = (done: boolean, failed: boolean) => (done ? 1 : 0) + (failed ? 2 : 0);

export function withOptimisticDone(repo: TaskRepository): OptimisticRepository {
  const pending = new Map<string, Pending>();
  /** Repository object → the same task with another status, by statusKey (shared by all lists). */
  const patched = new WeakMap<Task, (Task | undefined)[]>();
  /** Repository object → the equal object already on screen (set when a write is confirmed). */
  const alias = new WeakMap<Task, Task>();
  const sources = new Set<Source>();
  const hub = createSubscriptionHub<Task[]>();
  let seq = 0;

  /** The cached patched object of `t` (if made), without creating one. */
  const cached = (t: Task, p: Patch): Task | undefined =>
    patched.get(t)?.[statusKey(p.done ?? t.done, p.failed ?? t.failed)];

  /** `t` with patch `p` applied — one object per repository object and status. */
  const apply = (t: Task, p: Patch): Task => {
    const done = p.done ?? t.done;
    const failed = p.failed ?? t.failed;
    let byStatus = patched.get(t);
    if (!byStatus) {
      byStatus = [];
      patched.set(t, byStatus);
    }
    const k = statusKey(done, failed);
    let v = byStatus[k];
    if (!v) {
      v = { ...t, done, failed };
      byStatus[k] = v;
    }
    return v;
  };

  /** Whether the overlay of `p` still applies to source `s`. */
  const applies = (p: Pending, s: Source): boolean => !p.confirmedAt || p.confirmedAt.get(s) === s.version;

  /** The object source `s` shows for a repository task. */
  const show = (t: Task, s: Source): Task => {
    const p = pending.get(t.id);
    if (p && !matches(t, p.patch) && applies(p, s)) return apply(t, p.patch);
    return alias.get(t) ?? t;
  };

  /** The repository's current object for a task, preferring range lists (they also hold done tasks). */
  function find(id: string): Task | undefined {
    let fallback: Task | undefined;
    for (const s of sources) {
      const t = s.base?.find((x) => x.id === id);
      if (!t) continue;
      if (!s.open) return t;
      fallback ??= t;
    }
    return fallback;
  }

  function compute(s: Source, base: Task[]): Task[] {
    let out: Task[];
    if (!s.open || pending.size === 0) {
      out = base.map((t) => show(t, s));
      if (sameElements(base, out)) out = base;
    } else {
      out = [];
      const seen = new Set<string>();
      for (const t of base) {
        seen.add(t.id);
        const v = show(t, s);
        if (v.done) continue; // optimistically done: not open any more
        out.push(v);
      }
      for (const [id, p] of pending) {
        if (p.patch.done !== false || seen.has(id) || !applies(p, s)) continue;
        // Optimistically not done: open again. Firestore orders a `done == false` query by document id.
        const t = find(id);
        if (!t) continue;
        const v = show(t, s);
        if (v.done) continue;
        const at = out.findIndex((x) => x.id > id);
        if (at < 0) out.push(v);
        else out.splice(at, 0, v);
      }
    }
    if (s.out && (sameElements(s.out, out) || (s.open && sameMembers(s.out, out)))) return s.out;
    return out;
  }

  function refresh(list: Iterable<Source>) {
    // Copy: a subscriber may unsubscribe (and so remove a source) while being notified.
    for (const s of [...list]) {
      if (!s.base || !sources.has(s)) continue;
      const out = compute(s, s.base);
      if (out === s.out) continue;
      s.out = out;
      s.emit(out);
    }
  }

  /** Keeps showing the object the UI already has for a confirmed task if `t` has the same content. */
  function adopt(p: Pending, t: Task) {
    if (!p.from) return;
    const shown = matches(p.from, p.patch) ? (alias.get(p.from) ?? p.from) : cached(p.from, p.patch);
    if (shown && shown !== t && sameTask(shown, t)) alias.set(t, shown);
  }

  function markConfirmed(p: Pending) {
    if (!p.confirmedAt) p.confirmedAt = new Map([...sources].map((s) => [s, s.version]));
  }

  /** True if source `s` would show the same thing without the overlay of `p` (task `id`). */
  function noop(p: Pending, id: string, s: Source): boolean {
    const t = s.base?.find((x) => x.id === id);
    if (t) return matches(t, p.patch);
    // Absent: a range list cannot gain it; the open list would (re)insert it if the patch undoes done.
    return !s.open || p.patch.done !== false;
  }

  /** Drops confirmed entries no live list needs any more. Never changes what is shown. */
  function gc() {
    for (const [id, p] of pending) {
      if (!p.confirmedAt) continue;
      let needed = false;
      for (const s of sources) {
        if (s.base && applies(p, s) && !noop(p, id, s)) {
          needed = true;
          break;
        }
      }
      if (!needed) pending.delete(id);
    }
  }

  function onBase(s: Source, v: Task[]) {
    s.base = v;
    s.version++;
    if (pending.size) {
      for (const t of v) {
        const p = pending.get(t.id);
        if (!p || !matches(t, p.patch)) continue;
        adopt(p, t);
        // A snapshot still carrying the pre-write object was produced before the write: not a confirmation.
        if (t !== p.from) markConfirmed(p);
      }
    }
    refresh([s]);
    if (pending.size) gc();
  }

  function settle(id: string, mine: number, ok: boolean) {
    const p = pending.get(id);
    if (!p || p.seq !== mine) return; // superseded by a newer write
    if (!ok) {
      pending.delete(id);
      refresh(sources);
      return;
    }
    markConfirmed(p);
    const t = find(id);
    if (t && matches(t, p.patch)) adopt(p, t);
    gc();
  }

  function listen(key: string, open: boolean, subscribe: (cb: (t: Task[]) => void) => () => void, cb: (t: Task[]) => void) {
    return hub.subscribe(
      key,
      (emit) => {
        const s: Source = { open, base: null, out: null, version: 0, emit };
        sources.add(s);
        const off = subscribe((v) => {
          if (sources.has(s)) onBase(s, v);
        });
        return () => {
          sources.delete(s);
          off();
          if (pending.size) gc();
        };
      },
      cb,
    );
  }

  /** Records `patch` for task `id`, shows it everywhere at once, then issues the repository write. */
  function write(id: string, patch: Patch, call: () => Promise<void>): Promise<void> {
    const mine = ++seq;
    const prev = pending.get(id);
    // Laid over an older write's intent: the overlay shows the state after all of them, in order.
    pending.set(id, { patch: prev ? { ...prev.patch, ...patch } : patch, seq: mine, from: find(id), confirmedAt: null });
    refresh(sources);
    let w: Promise<void>;
    try {
      w = Promise.resolve(call());
    } catch (e) {
      w = Promise.reject(e);
    }
    return w.then(
      () => settle(id, mine, true),
      (e: unknown) => {
        settle(id, mine, false);
        throw e;
      },
    );
  }

  return {
    get pendingCount() {
      return pending.size;
    },
    subscribeRange: (fromYmd, toYmd, cb) =>
      listen(`range:${fromYmd}|${toYmd}`, false, (f) => repo.subscribeRange(fromYmd, toYmd, f), cb),
    subscribeOpen: (cb) => listen('open', true, (f) => repo.subscribeOpen(f), cb),
    add: (input) => repo.add(input),
    addMany: (inputs) => repo.addMany(inputs),
    remove: (id) => repo.remove(id),
    removeSeries: (recurrenceId, fromYmd) => repo.removeSeries(recurrenceId, fromYmd),
    setDone: (id, done) => write(id, done ? { done: true, failed: false } : { done: false }, () => repo.setDone(id, done)),
    setFailed: (id, failed) =>
      write(id, failed ? { failed: true, done: false } : { failed: false }, () => repo.setFailed(id, failed)),
  };
}

/** Same length and the same elements (by identity), in any order. */
function sameMembers<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}
