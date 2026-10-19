import type { Task } from '../model/task';

/** Timed tasks first (ascending time), then untimed in creation order. Done tasks keep their place. */
export function sortTasks(list: readonly Task[]): Task[] {
  return list.slice().sort((a, b) => {
    const at = a.time || '';
    const bt = b.time || '';
    if (at && bt) {
      if (at !== bt) return at < bt ? -1 : 1;
      return (a.createdAt || 0) - (b.createdAt || 0);
    }
    if (at) return -1;
    if (bt) return 1;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}

/** Not done, not failed and on a day before today. Stays on its own day — never moved. */
export function isOverdue(t: Task, todayYmd: string): boolean {
  return !t.done && !t.failed && t.date < todayYmd;
}

/** Still to do: neither done nor failed. */
export function isOpen(t: Task): boolean {
  return !t.done && !t.failed;
}

/**
 * Group tasks by date, each group sorted.
 * Optional `prev` (an earlier result): a group whose sorted tasks are the same objects in the same
 * order as in `prev` is returned as that same array, so unchanged days keep their identity
 * (React.memo on a day's list). The content of the result does not depend on `prev`.
 */
export function groupByDate(list: readonly Task[], prev?: Readonly<Record<string, Task[]>> | null): Record<string, Task[]> {
  const groups: Record<string, Task[]> = {};
  for (const t of list) (groups[t.date] ||= []).push(t);
  for (const k of Object.keys(groups)) {
    const sorted = sortTasks(groups[k]);
    const old = prev && Object.prototype.hasOwnProperty.call(prev, k) ? prev[k] : undefined;
    groups[k] = old && sameOrder(old, sorted) ? old : sorted;
  }
  return groups;
}

function sameOrder(a: readonly Task[], b: readonly Task[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** `HH:MM` check for the optional time field. */
export function normalizeTime(v: string | null | undefined): string | null {
  const s = (v || '').trim().slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : null;
}
