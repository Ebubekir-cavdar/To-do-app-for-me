/// <reference types="jest" />
/**
 * In-memory stand-in for `@react-native-firebase/firestore` (the modular functions the repository
 * uses), behaving like the native SDK with persistence on: writes land in the "local cache" at once
 * and every listener whose result set changed gets one snapshot (latency compensation); listeners
 * whose result did not change get nothing (no metadata-only snapshots). Snapshots are delivered
 * asynchronously, like events crossing the bridge, and `data()` returns a fresh copy each call.
 *
 * Counters in `stats` measure the data layer's work: listeners opened, snapshots delivered,
 * documents deserialized.
 *
 * Use as `jest.mock('@react-native-firebase/firestore', () => require('<path>/testing/mockFirestore').createFirestoreMock())`
 * and reach it with `jest.requireMock('@react-native-firebase/firestore') as FirestoreMock`.
 */

type Data = Record<string, unknown>;
/** What the mock's deleteField() returns: an update patch value that removes the field. */
const DELETE_FIELD = Object.freeze({ kind: 'deleteField' });
type Constraint = { field: string; op: '==' | '>=' | '<='; value: unknown };
type Col = { kind: 'collection'; path: string };
type Ref = { kind: 'doc'; id: string; path: string; parent: string };
type Q = { kind: 'query'; col: Col; constraints: Constraint[] };

export interface FirestoreStats {
  listenersCreated: number;
  listenersActive: number;
  snapshotsDelivered: number;
  docsDeserialized: number;
}

export interface FirestoreMock {
  /** Document path → data. */
  store: Map<string, Data>;
  stats: FirestoreStats;
  /** Puts documents into the store without notifying anyone (seed before mounting). */
  seed(colPath: string, docs: Data[]): void;
  resetStats(): void;
  reset(): void;
  [k: string]: unknown;
}

export function createFirestoreMock(): FirestoreMock {
  let autoId = 0;
  const store = new Map<string, Data>();
  const stats: FirestoreStats = { listenersCreated: 0, listenersActive: 0, snapshotsDelivered: 0, docsDeserialized: 0 };
  type Listener = { q: Q; next: (s: unknown) => void; last: string | null; active: boolean };
  const listeners = new Set<Listener>();

  const parentOf = (path: string) => path.slice(0, path.lastIndexOf('/'));
  const idOf = (path: string) => path.slice(path.lastIndexOf('/') + 1);

  const test = (c: Constraint, v: unknown) => {
    if (c.op === '==') return v === c.value;
    if (typeof v !== typeof c.value || v === undefined || v === null) return false;
    return c.op === '>=' ? (v as string) >= (c.value as string) : (v as string) <= (c.value as string);
  };

  function results(q: Q): [string, Data][] {
    const rows = [...store].filter(([p, d]) => parentOf(p) === q.col.path && q.constraints.every((c) => test(c, d[c.field])));
    // Firestore orders by the inequality field first (if any), then by document id.
    const range = q.constraints.find((c) => c.op !== '==');
    return rows.sort(([pa, a], [pb, b]) => {
      if (range) {
        const x = a[range.field] as string;
        const y = b[range.field] as string;
        if (x !== y) return x < y ? -1 : 1;
      }
      const ia = idOf(pa);
      const ib = idOf(pb);
      return ia < ib ? -1 : ia > ib ? 1 : 0;
    });
  }

  function snapshotOf(rows: [string, Data][]) {
    return {
      docs: rows.map(([p, d]) => ({
        id: idOf(p),
        data: () => {
          stats.docsDeserialized++;
          return JSON.parse(JSON.stringify(d)) as Data;
        },
      })),
    };
  }

  function deliver(l: Listener) {
    if (!l.active) return;
    const rows = results(l.q);
    const sig = JSON.stringify(rows);
    if (sig === l.last) return;
    l.last = sig;
    stats.snapshotsDelivered++;
    l.next(snapshotOf(rows));
  }

  /** After a write: every listener re-evaluates asynchronously (one snapshot per changed listener). */
  const fanOut = () => {
    const ls = [...listeners];
    Promise.resolve().then(() => ls.forEach(deliver));
  };

  const m = {
    store,
    stats,
    seed(colPath: string, docs: Data[]) {
      for (const d of docs) store.set(`${colPath}/${d.id as string}`, { ...d });
    },
    resetStats() {
      stats.listenersCreated = 0;
      stats.snapshotsDelivered = 0;
      stats.docsDeserialized = 0;
    },
    reset() {
      store.clear();
      listeners.clear();
      stats.listenersActive = 0;
      m.resetStats();
    },

    getFirestore: jest.fn(() => ({ kind: 'firestore' })),
    collection: jest.fn((_db: unknown, ...segments: string[]): Col => ({ kind: 'collection', path: segments.join('/') })),
    doc: jest.fn((col: Col, id?: string): Ref => {
      const docId = id ?? `auto${String(++autoId).padStart(6, '0')}`;
      return { kind: 'doc', id: docId, path: `${col.path}/${docId}`, parent: col.path };
    }),
    where: jest.fn((field: string, op: Constraint['op'], value: unknown): Constraint => ({ field, op, value })),
    query: jest.fn((col: Col, ...constraints: Constraint[]): Q => ({ kind: 'query', col, constraints })),
    onSnapshot: jest.fn((q: Q, next: (s: unknown) => void) => {
      const l: Listener = { q, next, last: null, active: true };
      listeners.add(l);
      stats.listenersCreated++;
      stats.listenersActive++;
      Promise.resolve().then(() => deliver(l));
      return () => {
        if (!l.active) return;
        l.active = false;
        listeners.delete(l);
        stats.listenersActive--;
      };
    }),
    setDoc: jest.fn((ref: Ref, data: Data) => {
      store.set(ref.path, { ...data });
      fanOut();
      return Promise.resolve();
    }),
    deleteField: jest.fn(() => DELETE_FIELD),
    updateDoc: jest.fn((ref: Ref, patch: Data) => {
      const cur = store.get(ref.path);
      if (!cur) return Promise.reject(new Error('not-found'));
      const next: Data = { ...cur, ...patch };
      for (const k of Object.keys(patch)) if (patch[k] === DELETE_FIELD) delete next[k];
      store.set(ref.path, next);
      fanOut();
      return Promise.resolve();
    }),
    deleteDoc: jest.fn((ref: Ref) => {
      store.delete(ref.path);
      fanOut();
      return Promise.resolve();
    }),
    writeBatch: jest.fn(() => {
      const ops: (() => void)[] = [];
      return {
        set: (ref: Ref, data: Data) => { ops.push(() => store.set(ref.path, { ...data })); },
        delete: (ref: Ref) => { ops.push(() => store.delete(ref.path)); },
        commit: () => {
          ops.forEach((op) => op());
          fanOut();
          return Promise.resolve();
        },
      };
    }),
    getDocsFromCache: jest.fn((q: Q) => Promise.resolve(snapshotOf(results(q)))),
    getDocsFromServer: jest.fn((q: Q) => Promise.resolve(snapshotOf(results(q)))),
  };
  return m as unknown as FirestoreMock;
}
