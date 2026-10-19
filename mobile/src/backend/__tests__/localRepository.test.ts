/// <reference types="jest" />
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Task } from '../../model/task';
import { createLocalRepository } from '../localRepository';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => AsyncStorage.clear());

describe('createLocalRepository', () => {
  it('notifies subscribers of its own writes and persists them', async () => {
    const repo = createLocalRepository('test.tasks');
    const range = jest.fn();
    const open = jest.fn();
    repo.subscribeRange('2026-10-12', '2026-10-18', range);
    repo.subscribeOpen(open);
    await flush();
    expect(range).toHaveBeenLastCalledWith([]);

    const t = await repo.add({ title: 'Market', date: '2026-10-17', time: null });
    await repo.add({ title: 'Outside range', date: '2026-11-01', time: null });
    expect(range.mock.lastCall?.[0].map((x: Task) => x.id)).toEqual([t.id]);
    expect(open.mock.lastCall?.[0]).toHaveLength(2);

    await repo.setDone(t.id, true);
    expect(open.mock.lastCall?.[0]).toHaveLength(1);

    const stored = JSON.parse((await AsyncStorage.getItem('test.tasks')) as string);
    expect(stored).toHaveLength(2);

    await repo.remove(t.id);
    expect(range.mock.lastCall?.[0]).toEqual([]);
  });

  it('shares one selection per query and only notifies a subscriber when its result changed', async () => {
    const repo = createLocalRepository('test.shared');
    const a = jest.fn();
    const b = jest.fn();
    const other = jest.fn();
    repo.subscribeRange('2026-10-12', '2026-10-18', a);
    repo.subscribeRange('2026-10-12', '2026-10-18', b);
    repo.subscribeRange('2026-11-01', '2026-11-07', other);
    await flush();
    expect(b.mock.lastCall?.[0]).toBe(a.mock.lastCall?.[0]); // same array

    const t = await repo.add({ title: 'Ekim', date: '2026-10-14', time: null });
    const u = await repo.add({ title: 'Ekim 2', date: '2026-10-15', time: null });
    expect(other).toHaveBeenCalledTimes(1); // only the initial empty result
    const before = a.mock.lastCall?.[0] as Task[];

    await repo.setDone(u.id, true);
    const after = a.mock.lastCall?.[0] as Task[];
    expect(after).not.toBe(before);
    expect(after[0]).toBe(before[0]); // untouched task keeps its object
    expect(after[0].id).toBe(t.id);
    expect(after[1]).toEqual({ ...before[1], done: true });
    expect(other).toHaveBeenCalledTimes(1);

    // A late subscriber gets the current result at once.
    const late = jest.fn();
    repo.subscribeRange('2026-10-12', '2026-10-18', late);
    expect(late.mock.calls[0][0]).toBe(after);
  });

  it('setFailed keeps failed ⇒ !done: failing un-does, done clears failed; failed tasks stay open', async () => {
    const repo = createLocalRepository('test.failed');
    const open = jest.fn();
    repo.subscribeOpen(open);
    await flush();
    const t = await repo.add({ title: 'Batu ile buluş', date: '2026-10-17', time: null });
    expect(t.failed).toBe(false);
    const cur = () => (open.mock.lastCall?.[0] as Task[]).find((x) => x.id === t.id);

    await repo.setFailed(t.id, true);
    expect(cur()).toMatchObject({ done: false, failed: true });
    await repo.setDone(t.id, true);
    expect(cur()).toBeUndefined(); // done: not open
    await repo.setFailed(t.id, true);
    expect(cur()).toMatchObject({ done: false, failed: true });
    await repo.setDone(t.id, false); // undone leaves failed as it is
    expect(cur()).toMatchObject({ done: false, failed: true });
    await repo.setFailed(t.id, false);
    expect(cur()).toMatchObject({ done: false, failed: false });
  });

  it('reads tasks stored before `failed` existed as not failed', async () => {
    const legacy = { id: 'old', title: 'Eski', date: '2026-10-01', time: null, done: false, createdAt: 1, categoryId: null, recurrenceId: null };
    await AsyncStorage.setItem('test.legacy', JSON.stringify([legacy]));
    const repo = createLocalRepository('test.legacy');
    const open = jest.fn();
    repo.subscribeOpen(open);
    await flush();
    expect(open.mock.lastCall?.[0]).toEqual([{ ...legacy, failed: false }]);
  });

  it('reloads persisted tasks', async () => {
    const a = createLocalRepository('test.reload');
    await a.add({ title: 'Kalıcı', date: '2026-10-17', time: '09:00' });
    const b = createLocalRepository('test.reload');
    const cb = jest.fn();
    b.subscribeOpen(cb);
    await flush();
    expect(cb.mock.lastCall?.[0].map((x: Task) => x.title)).toEqual(['Kalıcı']);
  });

  it('add() persists recurrenceId (default null) and validates input', async () => {
    const repo = createLocalRepository('test.add');
    const a = await repo.add({ title: ' Spor ', date: '2026-10-20', time: null, recurrenceId: 'r-1' });
    const b = await repo.add({ title: 'Tek', date: '2026-10-20', time: null });
    expect(a).toMatchObject({ title: 'Spor', recurrenceId: 'r-1' });
    expect(b.recurrenceId).toBeNull();
    await expect(repo.add({ title: '  ', date: '2026-10-20', time: null })).rejects.toThrow();
    await expect(repo.add({ title: 'x', date: '2026-10-20', time: null, recurrenceId: 5 as never })).rejects.toThrow();

    const stored = JSON.parse((await AsyncStorage.getItem('test.add')) as string);
    expect(stored.map((t: Task) => t.recurrenceId)).toEqual(['r-1', null]);
  });

  describe('addMany', () => {
    const series = (n: number, recurrenceId = 'r-1') =>
      Array.from({ length: n }, (_, i) => ({ title: 'Spor', date: `2026-10-${String(13 + i).padStart(2, '0')}`, time: '18:00', recurrenceId }));

    it('adds all tasks with unique ids and a shared recurrenceId; listeners see them all at once', async () => {
      const repo = createLocalRepository('test.many');
      const range = jest.fn();
      repo.subscribeRange('2026-10-01', '2026-10-31', range);
      await flush();
      range.mockClear();

      const tasks = await repo.addMany(series(7));

      expect(tasks).toHaveLength(7);
      expect(new Set(tasks.map((t) => t.id)).size).toBe(7);
      expect(tasks.every((t) => t.recurrenceId === 'r-1' && !t.done)).toBe(true);
      expect(range).toHaveBeenCalledTimes(1); // one notification for the whole series
      expect(range.mock.lastCall?.[0]).toHaveLength(7);
      const stored = JSON.parse((await AsyncStorage.getItem('test.many')) as string);
      expect(stored.map((t: Task) => t.id)).toEqual(tasks.map((t) => t.id));
    });

    it('rejects the whole call and writes nothing if any input is invalid, or > 200', async () => {
      const repo = createLocalRepository('test.many.bad');
      const open = jest.fn();
      repo.subscribeOpen(open);
      await flush();
      open.mockClear();

      const bad = series(5);
      bad[2] = { ...bad[2], title: '   ' };
      await expect(repo.addMany(bad)).rejects.toThrow();
      const many = Array.from({ length: 201 }, () => ({ title: 'x', date: '2026-10-20', time: null, recurrenceId: 'r-1' }));
      await expect(repo.addMany(many)).rejects.toThrow();

      expect(open).not.toHaveBeenCalled();
      expect(await AsyncStorage.getItem('test.many.bad')).toBeNull();
      expect(await repo.addMany(many.slice(1))).toHaveLength(200);
    });
  });

  describe('removeSeries', () => {
    it('deletes series tasks dated >= from (done or not), keeps earlier ones and other tasks', async () => {
      const repo = createLocalRepository('test.series');
      const mk = (date: string, recurrenceId: string | null) => ({ title: 'Spor', date, time: null, recurrenceId });
      const [past, from, futureDone, future] = await repo.addMany(
        ['2026-10-13', '2026-10-20', '2026-10-22', '2026-11-03'].map((d) => mk(d, 'r-1')),
      );
      const [otherSeries] = await repo.addMany([mk('2026-10-21', 'r-2')]);
      const single = await repo.add(mk('2026-10-21', null));
      await repo.setDone(futureDone.id, true);

      const range = jest.fn();
      repo.subscribeRange('2026-10-01', '2026-11-30', range);
      range.mockClear();

      const count = await repo.removeSeries('r-1', '2026-10-20');

      expect(count).toBe(3);
      expect(range).toHaveBeenCalledTimes(1);
      const left = range.mock.lastCall?.[0].map((t: Task) => t.id);
      expect(left).toEqual([past.id, otherSeries.id, single.id]);
      expect(left).not.toEqual(expect.arrayContaining([from.id, futureDone.id, future.id]));
      const stored = JSON.parse((await AsyncStorage.getItem('test.series')) as string);
      expect(stored.map((t: Task) => t.id)).toEqual([past.id, otherSeries.id, single.id]);
    });

    it('returns 0 without notifying when nothing matches; rejects invalid arguments', async () => {
      const repo = createLocalRepository('test.series.none');
      await repo.add({ title: 'Tek', date: '2026-10-21', time: null });
      const open = jest.fn();
      repo.subscribeOpen(open);
      open.mockClear();
      expect(await repo.removeSeries('r-9', '2026-10-01')).toBe(0);
      expect(open).not.toHaveBeenCalled();
      await expect(repo.removeSeries('', '2026-10-01')).rejects.toThrow();
      await expect(repo.removeSeries('r-1', 'bad')).rejects.toThrow();
    });
  });
});
