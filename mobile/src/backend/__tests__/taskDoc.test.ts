/// <reference types="jest" />
import { ADD_MANY_MAX, docToTask, newTask, newTasks, taskToDoc } from '../firebase/taskDoc';

describe('docToTask', () => {
  it('maps a complete document, using the document id', () => {
    const t = docToTask('doc-1', {
      id: 'stale-id',
      title: 'Spor salonu',
      date: '2026-10-17',
      time: '18:00',
      done: true,
      createdAt: 1700000000000,
      categoryId: 'cat-1',
      recurrenceId: 'rec-1',
    });
    expect(t).toEqual({
      id: 'doc-1',
      title: 'Spor salonu',
      date: '2026-10-17',
      time: '18:00',
      done: true,
      failed: false,
      createdAt: 1700000000000,
      categoryId: 'cat-1',
      recurrenceId: 'rec-1',
    });
  });

  it('reads `failed` only when it is exactly true (missing in older documents = false)', () => {
    const base = { title: 'Batu ile buluş', date: '2026-10-17', done: false };
    expect(docToTask('a', { ...base, failed: true })?.failed).toBe(true);
    expect(docToTask('a', base)?.failed).toBe(false);
    expect(docToTask('a', { ...base, failed: 'yes' })?.failed).toBe(false);
  });

  it('fills sane defaults for missing or malformed fields', () => {
    expect(docToTask('x', { date: '2026-01-05', time: '25:99', done: 'yes', createdAt: 'nope', categoryId: 7 })).toEqual({
      id: 'x',
      title: '',
      date: '2026-01-05',
      time: null,
      done: false,
      failed: false,
      createdAt: 0,
      categoryId: null,
      recurrenceId: null,
    });
  });

  it('accepts a Firestore Timestamp-like createdAt', () => {
    expect(docToTask('x', { date: '2026-01-05', createdAt: { toMillis: () => 42 } })?.createdAt).toBe(42);
  });

  it('drops documents without a usable date', () => {
    expect(docToTask('x', { title: 'a' })).toBeNull();
    expect(docToTask('x', { title: 'a', date: '17.10.2026' })).toBeNull();
    expect(docToTask('x', undefined)).toBeNull();
  });
});

describe('newTask', () => {
  it('normalizes input to pass the security rules', () => {
    const t = newTask('id1', { title: '  Fatura öde  ', date: '2026-10-17', time: 'bad' }, 123);
    expect(t).toEqual({
      id: 'id1', title: 'Fatura öde', date: '2026-10-17', time: null, done: false, failed: false, createdAt: 123, categoryId: null, recurrenceId: null,
    });
    expect(Array.from(newTask('id2', { title: 'ş'.repeat(300), date: '2026-10-17', time: '09:30' }, 1).title)).toHaveLength(200);
  });

  it('rejects empty titles and bad dates', () => {
    expect(() => newTask('id', { title: '   ', date: '2026-10-17', time: null }, 1)).toThrow();
    expect(() => newTask('id', { title: 'a', date: '2026-13-01', time: null }, 1)).toThrow();
  });

  it('taskToDoc writes exactly the Task fields, `failed` only while true', () => {
    const t = newTask('id1', { title: 'a', date: '2026-10-17', time: null }, 1);
    expect(Object.keys(taskToDoc({ ...t, extra: 1 } as never)).sort()).toEqual(
      ['categoryId', 'createdAt', 'date', 'done', 'id', 'recurrenceId', 'time', 'title'],
    );
    expect(taskToDoc({ ...t, failed: true })).toEqual({ ...taskToDoc(t), failed: true });
    expect(docToTask(t.id, taskToDoc(t))).toEqual(t);
    expect(docToTask(t.id, taskToDoc({ ...t, failed: true }))).toEqual({ ...t, failed: true });
  });
});

describe('recurrenceId on new tasks', () => {
  it('keeps a string recurrenceId; missing or null becomes null', () => {
    expect(newTask('a', { title: 'x', date: '2026-10-17', time: null, recurrenceId: 'r-1' }, 1).recurrenceId).toBe('r-1');
    expect(newTask('a', { title: 'x', date: '2026-10-17', time: null, recurrenceId: null }, 1).recurrenceId).toBeNull();
    expect(newTask('a', { title: 'x', date: '2026-10-17', time: null }, 1).recurrenceId).toBeNull();
  });

  it('rejects malformed recurrenceIds', () => {
    for (const bad of ['', 'r'.repeat(129), 7, {}, true]) {
      expect(() => newTask('a', { title: 'x', date: '2026-10-17', time: null, recurrenceId: bad as never }, 1)).toThrow();
    }
  });

  it('newTasks builds all or throws, capped at ADD_MANY_MAX', () => {
    let n = 0;
    const ids = () => `id${n++}`;
    const ok = { title: 'x', date: '2026-10-17', time: null, recurrenceId: 'r-1' };
    expect(newTasks([ok, ok], ids, 10).map((t) => [t.id, t.createdAt])).toEqual([['id0', 10], ['id1', 11]]);
    expect(() => newTasks([ok, { ...ok, date: 'x' }], ids, 1)).toThrow();
    expect(newTasks(Array(ADD_MANY_MAX).fill(ok), ids, 1)).toHaveLength(ADD_MANY_MAX);
    expect(() => newTasks(Array(ADD_MANY_MAX + 1).fill(ok), ids, 1)).toThrow();
  });
});

describe('docToTask with a previous task', () => {
  const data = { title: 'Spor', date: '2026-10-17', time: '18:00', done: false, createdAt: 5, categoryId: null, recurrenceId: 'r-1' };

  it('returns the previous object when every parsed field is equal', () => {
    const prev = docToTask('a', data)!;
    expect(docToTask('a', { ...data }, prev)).toBe(prev);
    // Normalization counts: an invalid time parses to null like before.
    const untimed = docToTask('a', { ...data, time: null })!;
    expect(docToTask('a', { ...data, time: 'bogus' }, untimed)).toBe(untimed);
  });

  it('returns a new object when any field differs', () => {
    const prev = docToTask('a', data)!;
    for (const patch of [{ title: 'Yüzme' }, { date: '2026-10-18' }, { time: '19:00' }, { done: true }, { failed: true }, { createdAt: 6 }, { categoryId: 'c' }, { recurrenceId: null }]) {
      const t = docToTask('a', { ...data, ...patch }, prev)!;
      expect(t).not.toBe(prev);
      expect(t).toEqual(docToTask('a', { ...data, ...patch }));
    }
    expect(docToTask('b', data, prev)).not.toBe(prev); // another id
    expect(docToTask('a', { ...data, date: 'x' }, prev)).toBeNull();
  });
});
