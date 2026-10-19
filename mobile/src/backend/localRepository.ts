import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NewTask, Task } from '../model/task';
import type { TaskRepository } from '../data/types';
import { addDays, mondayOf, startOfDay, ymd } from '../lib/dates';
import { isYmd, newTask, newTasks } from './firebase/taskDoc';
import { createSubscriptionHub, sameElements } from './sharedSubscriptions';

/** Offline-only repository on AsyncStorage (localStorage on web). Used for web preview and tests. */
export function createLocalRepository(key = 'todoapp.tasks.v1', opts: { seed?: boolean } = {}): TaskRepository {
  let tasks: Task[] = [];
  let ready = false;
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((l) => l());
  const persist = () => AsyncStorage.setItem(key, JSON.stringify(tasks)).catch(() => {});

  const loaded = AsyncStorage.getItem(key)
    .then((raw) => {
      if (raw === null) {
        tasks = opts.seed ? seedTasks() : [];
        if (opts.seed) persist();
      } else {
        const arr = JSON.parse(raw);
        tasks = Array.isArray(arr)
          ? arr
              .filter((x) => x && typeof x === 'object' && typeof x.date === 'string')
              // Stored before `failed` existed: missing reads as false (like Firestore documents).
              .map((x: Task) => (typeof x.failed === 'boolean' ? x : { ...x, failed: false }))
          : [];
      }
    })
    .catch(() => { tasks = []; })
    .finally(() => { ready = true; notify(); });

  // Same sharing as the Firestore backend: one selection per distinct query, delivered (as the
  // same array) to every subscriber of it, and only when its result changed. Task objects are
  // only replaced when they change (setDone / setFailed spread just the changed one), so identity holds.
  const hub = createSubscriptionHub<Task[]>();
  function subscribe(key: string, select: () => Task[], cb: (t: Task[]) => void) {
    return hub.subscribe(
      key,
      (emit) => {
        let last: Task[] | null = null;
        const run = () => {
          if (!ready) return;
          const next = select();
          if (sameElements(last, next)) return;
          last = next;
          emit(next);
        };
        listeners.add(run);
        run();
        return () => { listeners.delete(run); };
      },
      cb,
    );
  }

  return {
    subscribeRange: (from, to, cb) => subscribe(`range:${from}|${to}`, () => tasks.filter((t) => t.date >= from && t.date <= to), cb),
    subscribeOpen: (cb) => subscribe('open', () => tasks.filter((t) => !t.done), cb),
    // Same validation/normalization as the Firestore backend (taskDoc is pure, no native code).
    async add(input: NewTask) {
      const t = newTask(newId(), input, Date.now());
      await loaded;
      tasks = [...tasks, t];
      notify();
      await persist();
      return t;
    },
    async addMany(inputs: NewTask[]) {
      // Throws before any change if one input is invalid or there are too many.
      const created = newTasks(inputs, newId, Date.now());
      await loaded;
      if (created.length) {
        tasks = [...tasks, ...created];
        notify();
        await persist();
      }
      return created;
    },
    async removeSeries(recurrenceId: string, fromYmd: string) {
      if (typeof recurrenceId !== 'string' || !recurrenceId) throw new Error('Geçersiz tekrar kimliği.');
      if (!isYmd(fromYmd)) throw new Error('Geçersiz tarih.');
      await loaded;
      const kept = tasks.filter((t) => !(t.recurrenceId === recurrenceId && t.date >= fromYmd));
      const count = tasks.length - kept.length;
      if (count) {
        tasks = kept;
        notify();
        await persist();
      }
      return count;
    },
    async setDone(id, done) {
      await loaded;
      // done ⇒ not failed (failed ⇒ !done); undoing leaves `failed` as it is.
      tasks = tasks.map((t) => (t.id === id ? (done ? { ...t, done, failed: false } : { ...t, done }) : t));
      notify();
      await persist();
    },
    async setFailed(id, failed) {
      await loaded;
      tasks = tasks.map((t) => (t.id === id ? (failed ? { ...t, failed, done: false } : { ...t, failed }) : t));
      notify();
      await persist();
    },
    async remove(id) {
      await loaded;
      tasks = tasks.filter((t) => t.id !== id);
      notify();
      await persist();
    },
  };
}

let idSeq = 0;
function newId(): string {
  // The counter keeps ids unique even when many are made in the same millisecond (addMany).
  return Date.now().toString(36) + '-' + (idSeq++).toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

/** Same sample data as designs/final.html, relative to today, for the web preview. */
export function seedTasks(now = new Date()): Task[] {
  const t = startOfDay(now);
  const mon = mondayOf(t);
  const base = now.getTime() - 60000;
  let c = 0;
  const mk = (title: string, off: number, time: string | null, done: boolean, from: Date = t): Task => ({
    id: newId() + c, title, date: ymd(addDays(from, off)), time, done, failed: false, createdAt: base + c++ * 1000, categoryId: null, recurrenceId: null,
  });
  return [
    mk('Diş hekimi randevusu al', -3, null, false, mon),
    mk('Fatura öde', -2, '10:00', true),
    mk('Kitap oku 30 dk', -1, null, true),
    mk('Annemi ara', -1, '19:30', false),
    mk('Sabah yürüyüşü', 0, '07:30', true),
    mk('Spor salonu', 0, '18:00', false),
    mk('Market alışverişi', 0, null, false),
    mk('E-postaları yanıtla', 0, null, false),
    mk('Proje sunumunu hazırla', 1, '14:00', false),
    mk('Çamaşırları yıka', 2, null, false),
    mk('Arkadaşlarla akşam yemeği', 3, '20:00', false),
  ];
}
