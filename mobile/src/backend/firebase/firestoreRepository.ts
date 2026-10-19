/**
 * TaskRepository on Cloud Firestore (RNFirebase modular API), offline-first.
 *
 * - Firestore's on-device persistence is ON by default on Android, so reads are served from
 *   the local cache when offline and writes are queued and synced later. We never disable it.
 * - Writes are applied to the local cache immediately, so onSnapshot listeners fire with the
 *   pending write right away (latency compensation). The returned write promises resolve only
 *   when the server acknowledges — callers must not await them for UI updates.
 * - Listeners are shared: subscribers of the same query (same range, or the open tasks) share one
 *   onSnapshot listener, ref-counted (see sharedSubscriptions). Each snapshot reuses the previous
 *   Task object of every unchanged document and is not delivered at all if no task changed, so
 *   consumers can rely on identity (React.memo). Snapshots are listened to without
 *   includeMetadataChanges (the default), so metadata-only changes (pending write acked,
 *   fromCache flips) never reach JS.
 * - Queries are single-field (date range / done == false / recurrenceId ==), so no composite
 *   index is needed.
 * - `failed` is stored only while true: clearing it deletes the field (deleteField), so a document
 *   never carries `failed: false` and old documents need no migration (they read as false).
 *   setDone(true) / setFailed(true) change both fields in ONE updateDoc (atomic: failed ⇒ !done).
 * - Batches (addMany / removeSeries) are committed with writeBatch: the native SDK applies the
 *   whole batch to the local cache at once (listeners fire once with every change) and syncs it
 *   atomically later. commit() resolves on server ack, so it is never awaited for the result.
 */
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocsFromCache,
  getDocsFromServer,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
  type Query,
  type QuerySnapshot,
} from '@react-native-firebase/firestore';
import type { TaskRepository } from '../../data/types';
import type { NewTask, Task } from '../../model/task';
import { createSubscriptionHub, sameElements } from '../sharedSubscriptions';
import { docToTask, isYmd, newTask, newTasks, sameTask, taskToDoc } from './taskDoc';

/** Firestore's hard limit on writes per batch. */
export const BATCH_LIMIT = 500;
/** How long removeSeries waits for the server sweep before giving up (offline / flaky network). */
export const SERVER_SWEEP_TIMEOUT_MS = 5000;

export function tasksPath(uid: string): [string, string, string] {
  return ['users', uid, 'tasks'];
}

export interface FirestoreRepositoryOptions {
  /** Timeout for removeSeries' best-effort server query. Default SERVER_SWEEP_TIMEOUT_MS. */
  serverSweepTimeoutMs?: number;
}

export function createFirestoreRepository(
  uid: string,
  db: Firestore = getFirestore(),
  opts: FirestoreRepositoryOptions = {},
): TaskRepository {
  if (!uid) throw new Error('createFirestoreRepository: uid is required');
  const tasksCol = collection(db, ...tasksPath(uid));
  const taskRef = (id: string) => doc(tasksCol, id);
  const sweepTimeoutMs = opts.serverSweepTimeoutMs ?? SERVER_SWEEP_TIMEOUT_MS;

  /** Deletes the given task ids in batches of <= 500. Not awaited (see header). */
  function deleteInBatches(ids: string[]): void {
    for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db);
      ids.slice(i, i + BATCH_LIMIT).forEach((id) => batch.delete(taskRef(id)));
      batch.commit().catch((e: unknown) => console.warn('[firestore] removeSeries batch failed', e));
    }
  }

  /**
   * One Firestore listener per distinct query, shared by every subscriber of it (the week screen
   * and the notifications engine both want the open tasks: one listener, not two).
   */
  const hub = createSubscriptionHub<Task[]>();
  /** Last mapped result of every live listener, by task id — to reuse unchanged Task objects. */
  const live = new Set<Map<string, Task>>();

  /** Another live listener's object for a task. */
  function fromOther(own: Map<string, Task>, id: string): Task | undefined {
    for (const other of live) {
      if (other === own) continue;
      const t = other.get(id);
      if (t) return t;
    }
    return undefined;
  }

  /**
   * Maps one document, reusing an existing object when the content is unchanged: this listener's
   * own, else another live listener's. A task that changed (e.g. a toggle seen by both the range
   * and the open listener) also takes the object another listener already made for the new
   * content, so both lists hold the same object for it.
   */
  function mapDoc(own: Map<string, Task>, id: string, data: unknown): Task | null {
    const mine = own.get(id);
    const t = docToTask(id, data, mine ?? fromOther(own, id));
    if (t && mine && t !== mine) {
      const other = fromOther(own, id);
      if (other && sameTask(other, t)) return other;
    }
    return t;
  }

  function listen(key: string, makeQuery: () => Query, label: string, cb: (tasks: Task[]) => void): () => void {
    return hub.subscribe(
      key,
      (emit, fail) => {
        let active = true;
        let byId = new Map<string, Task>();
        let last: Task[] | null = null;
        live.add(byId);
        const unsubscribe = onSnapshot(
          makeQuery(),
          (snap: QuerySnapshot) => {
            if (!active) return;
            const tasks: Task[] = [];
            const next = new Map<string, Task>();
            snap.docs.forEach((d) => {
              const t = mapDoc(byId, d.id, d.data());
              if (t) {
                tasks.push(t);
                next.set(t.id, t);
              }
            });
            live.delete(byId);
            byId = next;
            live.add(byId);
            // Same tasks (by identity) in the same order: nothing changed for subscribers.
            if (sameElements(last, tasks)) return;
            last = tasks;
            emit(tasks);
          },
          (error) => {
            console.warn(`[firestore] ${label} listener failed`, error);
            fail();
          },
        );
        return () => {
          if (!active) return;
          active = false;
          live.delete(byId);
          unsubscribe();
        };
      },
      cb,
    );
  }

  return {
    subscribeRange(fromYmd, toYmd, cb) {
      return listen(
        `range:${fromYmd}|${toYmd}`,
        () => query(tasksCol, where('date', '>=', fromYmd), where('date', '<=', toYmd)),
        `range ${fromYmd}..${toYmd}`,
        cb,
      );
    },

    subscribeOpen(cb) {
      return listen('open', () => query(tasksCol, where('done', '==', false)), 'open tasks', cb);
    },

    add(input: NewTask) {
      let task: Task;
      try {
        // doc() without an id generates a Firestore auto-id on the client — no network needed.
        const ref = doc(tasksCol);
        task = newTask(ref.id, input, Date.now());
        // Not awaited: the local cache (and every listener) updates immediately; the promise
        // resolves only on server ack, which may be much later (or never while offline).
        setDoc(ref, taskToDoc(task)).catch((e: unknown) => console.warn('[firestore] add failed', e));
      } catch (e) {
        return Promise.reject(e);
      }
      return Promise.resolve(task);
    },

    addMany(inputs: NewTask[]) {
      let tasks: Task[];
      try {
        // Validate everything before touching Firestore: one bad input → nothing is written.
        tasks = newTasks(inputs, () => doc(tasksCol).id, Date.now());
        if (tasks.length) {
          const batch = writeBatch(db);
          tasks.forEach((t) => batch.set(taskRef(t.id), taskToDoc(t)));
          // Not awaited, like add(): the cache and listeners get the whole batch immediately.
          batch.commit().catch((e: unknown) => console.warn('[firestore] addMany failed', e));
        }
      } catch (e) {
        return Promise.reject(e);
      }
      return Promise.resolve(tasks);
    },

    /**
     * Offline strategy: cache first, then a best-effort server sweep.
     * 1. getDocsFromCache — answers instantly, online or offline. The cache holds every task this
     *    device created plus everything the listeners have synced (all open tasks via
     *    subscribeOpen, every viewed week). Matching docs are deleted in one batch right away, so
     *    the UI updates at once and the deletes queue for sync while offline.
     * 2. getDocsFromServer, raced against a short timeout — catches series tasks the cache never
     *    saw (e.g. done tasks created on another device in a week not opened here). Offline it
     *    rejects (or times out) and is simply skipped. Plain getDocs() (source 'default') is not
     *    used: on Android it waits for the server while the connection state is unknown before
     *    falling back to cache, which would delay the visible deletion by seconds.
     * Resolves with the number of tasks deleted across both steps. Delete commits are not
     * awaited (they resolve only on server ack).
     */
    async removeSeries(recurrenceId: string, fromYmd: string) {
      if (typeof recurrenceId !== 'string' || !recurrenceId) throw new Error('Geçersiz tekrar kimliği.');
      if (!isYmd(fromYmd)) throw new Error('Geçersiz tarih.');
      const q = query(tasksCol, where('recurrenceId', '==', recurrenceId));
      const deleted = new Set<string>();

      const sweep = (snap: QuerySnapshot | null) => {
        if (!snap) return;
        const ids: string[] = [];
        snap.docs.forEach((d) => {
          const t = docToTask(d.id, d.data());
          // Date filter client-side (no composite index); recurrenceId re-checked defensively.
          if (t && t.recurrenceId === recurrenceId && t.date >= fromYmd && !deleted.has(t.id)) ids.push(t.id);
        });
        ids.forEach((id) => deleted.add(id));
        deleteInBatches(ids);
      };

      sweep(
        await getDocsFromCache(q).catch((e: unknown) => {
          console.warn('[firestore] removeSeries cache query failed', e);
          return null;
        }),
      );
      sweep(await withTimeout(getDocsFromServer(q), sweepTimeoutMs).catch(() => null));
      return deleted.size;
    },

    setDone(id, done) {
      return updateDoc(taskRef(id), done ? { done: true, failed: deleteField() } : { done: false });
    },

    setFailed(id, failed) {
      return updateDoc(taskRef(id), failed ? { failed: true, done: false } : { failed: deleteField() });
    },

    remove(id) {
      return deleteDoc(taskRef(id));
    },
  };
}

/** Rejects if `p` has not settled within `ms`. The late result (or error) of `p` is ignored. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e: unknown) => { clearTimeout(timer); reject(e); },
    );
  });
}
