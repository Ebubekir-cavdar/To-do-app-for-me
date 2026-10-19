/**
 * Firestore document <-> Task mapping. Pure (no native imports) so it is unit-testable.
 * Document path: users/{uid}/tasks/{taskId}; fields are the `Task` shape, except that `failed` is
 * optional: it is only stored while true (documents without it — all older ones — read as false).
 */
import type { NewTask, Task } from '../../model/task';

export const TITLE_MAX = 200;
/** Longest accepted recurrenceId (lib/recurrence ids are ~20 chars). */
export const RECURRENCE_ID_MAX = 128;
/** Max inputs per addMany() call (TaskRepository contract). */
export const ADD_MANY_MAX = 200;

const YMD = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isYmd = (v: unknown): v is string => typeof v === 'string' && YMD.test(v);
export const isHm = (v: unknown): v is string => typeof v === 'string' && HM.test(v);

/**
 * Defensive parse of a task document. Missing/invalid fields get sane defaults;
 * categoryId/recurrenceId are preserved. Returns null only when the date is unusable,
 * since a task without a valid day cannot be placed anywhere.
 * The document id (not the stored `id` field) is authoritative.
 *
 * If `prev` is given and the parsed task equals it field by field, `prev` itself is returned
 * (no allocation) — so unchanged tasks keep their identity across snapshots.
 */
export function docToTask(id: string, data: unknown, prev?: Task | null): Task | null {
  const d = (typeof data === 'object' && data !== null ? data : {}) as Record<string, unknown>;
  if (!isYmd(d.date)) return null;
  const title = typeof d.title === 'string' ? d.title : typeof d.title === 'number' ? String(d.title) : '';
  const date = d.date;
  const time = isHm(d.time) ? d.time : null;
  const done = d.done === true;
  const failed = d.failed === true;
  const createdAt = toMillis(d.createdAt);
  const categoryId = typeof d.categoryId === 'string' ? d.categoryId : null;
  const recurrenceId = typeof d.recurrenceId === 'string' ? d.recurrenceId : null;
  if (
    prev &&
    prev.id === id &&
    prev.title === title &&
    prev.date === date &&
    prev.time === time &&
    prev.done === done &&
    prev.failed === failed &&
    prev.createdAt === createdAt &&
    prev.categoryId === categoryId &&
    prev.recurrenceId === recurrenceId
  ) {
    return prev;
  }
  return { id, title, date, time, done, failed, createdAt, categoryId, recurrenceId };
}

/** True when both tasks have the same content, field by field. */
export function sameTask(a: Task, b: Task): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.date === b.date &&
    a.time === b.time &&
    a.done === b.done &&
    a.failed === b.failed &&
    a.createdAt === b.createdAt &&
    a.categoryId === b.categoryId &&
    a.recurrenceId === b.recurrenceId
  );
}

function toMillis(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Tolerate a Firestore Timestamp in case a document was written by another tool.
  if (typeof v === 'object' && v !== null && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    const ms = (v as { toMillis: () => unknown }).toMillis();
    if (typeof ms === 'number' && Number.isFinite(ms)) return ms;
  }
  return 0;
}

/**
 * Build a new Task from UI input, normalized so it passes firestore.rules
 * (title trimmed and capped at 200 characters, time null or HH:MM,
 * recurrenceId a non-empty string or null; missing → null).
 * Throws if the title is empty, the date is not YYYY-MM-DD or the recurrenceId is malformed.
 */
export function newTask(id: string, input: NewTask, now: number): Task {
  if (typeof input !== 'object' || input === null) throw new Error('Geçersiz görev.');
  const title = Array.from(typeof input.title === 'string' ? input.title.trim() : '').slice(0, TITLE_MAX).join('');
  if (!title) throw new Error('Görev başlığı boş olamaz.');
  if (!isYmd(input.date)) throw new Error('Geçersiz tarih.');
  const recurrenceId = input.recurrenceId ?? null;
  if (recurrenceId !== null && !(typeof recurrenceId === 'string' && recurrenceId.length >= 1 && recurrenceId.length <= RECURRENCE_ID_MAX)) {
    throw new Error('Geçersiz tekrar kimliği.');
  }
  return {
    id,
    title,
    date: input.date,
    time: isHm(input.time) ? input.time : null,
    done: false,
    failed: false,
    createdAt: now,
    categoryId: null,
    recurrenceId,
  };
}

/**
 * Validates and builds all tasks of an addMany() call, all-or-nothing: throws (having built
 * nothing usable) if there are more than ADD_MANY_MAX inputs or any input is invalid.
 * `makeId` is called once per input, in order.
 */
export function newTasks(inputs: NewTask[], makeId: () => string, now: number): Task[] {
  if (!Array.isArray(inputs)) throw new Error('Geçersiz görev listesi.');
  if (inputs.length > ADD_MANY_MAX) throw new Error(`Tek seferde en fazla ${ADD_MANY_MAX} görev eklenebilir.`);
  // createdAt + i keeps the input order stable if two inputs share a day.
  return inputs.map((input, i) => newTask(makeId(), input, now + i));
}

/** A task document as stored: every Task field except `failed`, which is present only while true. */
export type TaskDoc = Omit<Task, 'failed'> & { failed?: true };

/**
 * The exact document written for a task (all Task fields, nothing else). `failed` is omitted
 * unless true, so new tasks are written exactly as before the field existed.
 */
export function taskToDoc(t: Task): TaskDoc {
  const d: TaskDoc = {
    id: t.id,
    title: t.title,
    date: t.date,
    time: t.time,
    done: t.done,
    createdAt: t.createdAt,
    categoryId: t.categoryId,
    recurrenceId: t.recurrenceId,
  };
  if (t.failed) d.failed = true;
  return d;
}
