/**
 * Ref-counted shared subscriptions: every subscriber of the same key shares ONE underlying source
 * (e.g. one Firestore listener). The source starts with the first subscriber and stops when the
 * last one leaves. A subscriber that joins while the source is live gets its latest value at once
 * (synchronously), then every later value — the same array instance every other subscriber gets.
 *
 * A source emits only when its value changed (`emit(sameValue)` is a no-op), so subscribers can
 * rely on identity: a new value means new data.
 */

/** Starts the underlying source. Call `emit` with each new value and `fail` if the source died. Returns stop. */
export type StartSource<T> = (emit: (value: T) => void, fail: () => void) => () => void;

export interface SubscriptionHub<T> {
  subscribe(key: string, start: StartSource<T>, cb: (value: T) => void): () => void;
  /** Number of live underlying sources (for tests). */
  readonly size: number;
}

interface Entry<T> {
  subs: Set<(value: T) => void>;
  has: boolean;
  value: T | undefined;
  stop: (() => void) | null;
  stopped: boolean;
}

export function createSubscriptionHub<T>(): SubscriptionHub<T> {
  const entries = new Map<string, Entry<T>>();

  return {
    get size() {
      return entries.size;
    },

    subscribe(key, start, cb) {
      // A wrapper per call: the same callback subscribed twice is two subscriptions.
      const listener = (v: T) => cb(v);
      let e = entries.get(key);
      if (e) {
        e.subs.add(listener);
        if (e.has) listener(e.value as T);
      } else {
        const entry: Entry<T> = { subs: new Set([listener]), has: false, value: undefined, stop: null, stopped: false };
        entries.set(key, entry);
        e = entry;
        const stop = start(
          (v) => {
            if (entry.stopped || (entry.has && entry.value === v)) return;
            entry.value = v;
            entry.has = true;
            // Copy: a subscriber may unsubscribe itself or others while being notified.
            for (const l of [...entry.subs]) if (entry.subs.has(l)) l(v);
          },
          () => {
            // The source is dead (e.g. a listener error): later subscribers start a fresh one.
            // Current subscribers keep the last value, as they would with their own listener.
            if (entries.get(key) === entry) entries.delete(key);
          },
        );
        entry.stop = stop;
      }
      const entry = e;
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        entry.subs.delete(listener);
        if (entry.subs.size > 0) return;
        if (entries.get(key) === entry) entries.delete(key);
        if (entry.stop && !entry.stopped) {
          entry.stopped = true;
          entry.stop();
        }
      };
    },
  };
}

/** True when both arrays hold the same elements (by identity) in the same order. */
export function sameElements<T>(a: readonly T[] | null | undefined, b: readonly T[]): boolean {
  if (!a || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
