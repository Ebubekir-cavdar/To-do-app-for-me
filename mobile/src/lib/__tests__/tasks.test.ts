/// <reference types="jest" />
import type { Task } from '../../model/task';
import { groupByDate, isOpen, isOverdue, normalizeTime, sortTasks } from '../tasks';

let seq = 0;
const task = (p: Partial<Task>): Task => ({
  id: 't' + ++seq,
  title: 'x',
  date: '2026-10-17',
  time: null,
  done: false,
  failed: false,
  createdAt: 1000,
  categoryId: null,
  recurrenceId: null,
  ...p,
});

describe('sortTasks', () => {
  it('puts timed tasks first (ascending), then untimed by createdAt', () => {
    const list = [
      task({ id: 'u2', createdAt: 20 }),
      task({ id: 't18', time: '18:00', createdAt: 1 }),
      task({ id: 'u1', createdAt: 10 }),
      task({ id: 't07', time: '07:30', createdAt: 99 }),
      task({ id: 't00', time: '00:00', createdAt: 50 }),
      task({ id: 't23', time: '23:59', createdAt: 2 }),
    ];
    expect(sortTasks(list).map((t) => t.id)).toEqual(['t00', 't07', 't18', 't23', 'u1', 'u2']);
  });

  it('breaks equal times by createdAt', () => {
    const list = [task({ id: 'b', time: '09:00', createdAt: 2 }), task({ id: 'a', time: '09:00', createdAt: 1 })];
    expect(sortTasks(list).map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('done tasks keep their position (done does not affect order)', () => {
    const list = [
      task({ id: 'u1', createdAt: 1, done: true }),
      task({ id: 't1', time: '10:00', done: true }),
      task({ id: 'u2', createdAt: 2 }),
      task({ id: 't0', time: '08:00' }),
    ];
    const undone = list.map((t) => ({ ...t, done: false }));
    expect(sortTasks(list).map((t) => t.id)).toEqual(['t0', 't1', 'u1', 'u2']);
    expect(sortTasks(list).map((t) => t.id)).toEqual(sortTasks(undone).map((t) => t.id));
  });

  it('does not mutate the input', () => {
    const list = [task({ id: 'b', createdAt: 2 }), task({ id: 'a', createdAt: 1 })];
    const copy = list.slice();
    sortTasks(list);
    expect(list).toEqual(copy);
  });
});

describe('groupByDate', () => {
  it('groups by day and sorts each group', () => {
    const g = groupByDate([
      task({ id: 'b', date: '2026-10-13', createdAt: 2 }),
      task({ id: 'c', date: '2026-10-14' }),
      task({ id: 'a', date: '2026-10-13', time: '08:00' }),
    ]);
    expect(Object.keys(g).sort()).toEqual(['2026-10-13', '2026-10-14']);
    expect(g['2026-10-13'].map((t) => t.id)).toEqual(['a', 'b']);
  });

  it('with prev: same content as without, and unchanged days keep their array', () => {
    const a = task({ id: 'a', date: '2026-10-13', time: '08:00' });
    const b = task({ id: 'b', date: '2026-10-13', createdAt: 2 });
    const c = task({ id: 'c', date: '2026-10-14' });
    const d = task({ id: 'd', date: '2026-10-15' });
    const first = groupByDate([b, c, a, d]);

    const c2 = { ...c, done: true };
    const e = task({ id: 'e', date: '2026-10-16' });
    const list = [a, c2, b, e];
    const next = groupByDate(list, first);
    expect(next).toEqual(groupByDate(list));
    expect(Object.keys(next)).toEqual(Object.keys(groupByDate(list)));
    expect(next['2026-10-13']).toBe(first['2026-10-13']); // same tasks, same order
    expect(next['2026-10-14']).not.toBe(first['2026-10-14']); // c changed
    expect(next['2026-10-15']).toBeUndefined(); // d gone
    expect(next['2026-10-16']).toEqual([e]);

    // A reorder (time edit) is a change.
    const a2 = { ...a, time: null, createdAt: 3 };
    const again = groupByDate([a2, b], next);
    expect(again['2026-10-13'].map((t) => t.id)).toEqual(['b', 'a']);
    expect(again['2026-10-13']).not.toBe(next['2026-10-13']);
    expect(groupByDate([], next)).toEqual({});
  });
});

describe('isOverdue', () => {
  const today = '2026-10-17';
  it('is true only for undone tasks on a day before today', () => {
    expect(isOverdue(task({ date: '2026-10-16' }), today)).toBe(true);
    expect(isOverdue(task({ date: '2025-12-31' }), today)).toBe(true);
    expect(isOverdue(task({ date: '2026-10-16', done: true }), today)).toBe(false);
    expect(isOverdue(task({ date: today }), today)).toBe(false);
    expect(isOverdue(task({ date: today, time: '00:00' }), today)).toBe(false);
    expect(isOverdue(task({ date: '2026-10-18' }), today)).toBe(false);
  });

  it('compares across year boundaries', () => {
    expect(isOverdue(task({ date: '2025-12-31' }), '2026-01-01')).toBe(true);
    expect(isOverdue(task({ date: '2026-01-01' }), '2025-12-31')).toBe(false);
  });
  it('is never true for a failed task (failed is final, not late)', () => {
    expect(isOverdue(task({ date: '2026-10-16', failed: true }), today)).toBe(false);
    expect(isOverdue(task({ date: '2025-12-31', failed: true }), today)).toBe(false);
  });
});

describe('isOpen', () => {
  it('is true only for tasks neither done nor failed', () => {
    expect(isOpen(task({}))).toBe(true);
    expect(isOpen(task({ done: true }))).toBe(false);
    expect(isOpen(task({ failed: true }))).toBe(false);
  });
});

describe('normalizeTime', () => {
  it.each(['00:00', '09:05', '19:30', '23:59'])('accepts %s', (v) => {
    expect(normalizeTime(v)).toBe(v);
  });

  it('trims whitespace', () => {
    expect(normalizeTime(' 08:15 ')).toBe('08:15');
  });

  it.each([['24:00'], ['7:30'], ['12:60'], ['1230'], ['ab:cd'], [''], ['   ']])('rejects %p', (v) => {
    expect(normalizeTime(v)).toBeNull();
  });

  it('rejects null and undefined', () => {
    expect(normalizeTime(null)).toBeNull();
    expect(normalizeTime(undefined)).toBeNull();
  });
});
