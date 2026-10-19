/// <reference types="jest" />
/**
 * Behaviour of the data hooks on the local backend (what web preview and tests use;
 * the Firebase backend follows the same TaskRepository contract).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { backend } from '../../backend';
import type { Task } from '../../model/task';
import { DataProvider, useData, useOpenTasks, useTaskActions, useTasksInRange } from '../DataProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;

// The local backend's repository is a module singleton created on first use: start it
// from an empty store (no seed data). Each test uses its own dates so they don't interact.
beforeAll(async () => {
  await AsyncStorage.setItem('todoapp.tasks.v1', '[]');
});

function useAll(from: string, to: string) {
  return { range: useTasksInRange(from, to), open: useOpenTasks(), actions: useTaskActions(), data: useData() };
}

const titles = (list: Task[]) => list.map((t) => t.title).sort();

async function mount(from: string, to: string) {
  const r = await renderHook((p: { from: string; to: string }) => useAll(p.from, p.to), {
    wrapper,
    initialProps: { from, to },
  });
  await waitFor(() => expect(r.result.current.range.loading).toBe(false));
  return r;
}

describe('DataProvider on the local backend', () => {
  it('is signed in as the local user with a repository', async () => {
    const { result } = await mount('2030-01-07', '2030-01-13');
    expect(result.current.data.mode).toBe('local');
    expect(result.current.data.status).toBe('signedIn');
    expect(result.current.data.repo).not.toBeNull();
    expect(result.current.range.tasks).toEqual([]);
  });

  it('add → appears in the range subscription and open tasks immediately', async () => {
    const { result } = await mount('2030-02-04', '2030-02-10');
    await act(async () => {
      result.current.actions.add({ title: 'Market', date: '2030-02-06', time: '09:00' });
    });
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['Market']));
    const t = result.current.range.tasks[0];
    expect(t).toMatchObject({ date: '2030-02-06', time: '09:00', done: false, categoryId: null, recurrenceId: null });
    expect(result.current.open.map((x) => x.id)).toContain(t.id);
  });

  it('range boundaries are inclusive and outside dates are excluded', async () => {
    const { result } = await mount('2030-03-04', '2030-03-10');
    await act(async () => {
      for (const date of ['2030-03-03', '2030-03-04', '2030-03-10', '2030-03-11']) {
        result.current.actions.add({ title: date, date, time: null });
      }
    });
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['2030-03-04', '2030-03-10']));
  });

  it('setDone toggles in place; open tasks drop the done one and get it back on undo', async () => {
    const { result } = await mount('2030-04-01', '2030-04-07');
    await act(async () => {
      result.current.actions.add({ title: 'Spor', date: '2030-04-02', time: null });
    });
    await waitFor(() => expect(result.current.range.tasks).toHaveLength(1));
    const id = result.current.range.tasks[0].id;

    await act(async () => result.current.actions.setDone(id, true));
    await waitFor(() => expect(result.current.range.tasks[0].done).toBe(true));
    expect(result.current.range.tasks).toHaveLength(1); // stays on its day
    expect(result.current.open.map((x) => x.id)).not.toContain(id);

    await act(async () => result.current.actions.setDone(id, false));
    await waitFor(() => expect(result.current.open.map((x) => x.id)).toContain(id));
    expect(result.current.range.tasks[0].done).toBe(false);
  });

  it('remove drops the task from range and open tasks', async () => {
    const { result } = await mount('2030-05-06', '2030-05-12');
    await act(async () => {
      result.current.actions.add({ title: 'Sil beni', date: '2030-05-07', time: null });
      result.current.actions.add({ title: 'Kalsın', date: '2030-05-07', time: null });
    });
    await waitFor(() => expect(result.current.range.tasks).toHaveLength(2));
    const id = result.current.range.tasks.find((t) => t.title === 'Sil beni')!.id;

    await act(async () => result.current.actions.remove(id));
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['Kalsın']));
    expect(result.current.open.map((x) => x.id)).not.toContain(id);
  });

  it('switching range never shows the previous range’s tasks under the new range', async () => {
    const { result, rerender } = await mount('2030-06-03', '2030-06-09');
    await act(async () => {
      result.current.actions.add({ title: 'A week', date: '2030-06-05', time: null });
      result.current.actions.add({ title: 'B week', date: '2030-06-12', time: null });
    });
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['A week']));

    const seen: string[][] = [];
    await rerender({ from: '2030-06-10', to: '2030-06-16' });
    seen.push(titles(result.current.range.tasks));
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['B week']));
    // Whatever was rendered during the switch, it was never the old week's data.
    expect(seen.flat()).not.toContain('A week');

    await rerender({ from: '2030-06-03', to: '2030-06-09' });
    await waitFor(() => expect(titles(result.current.range.tasks)).toEqual(['A week']));
  });

  it('keeps identities stable: results, arrays, unchanged tasks and the actions object', async () => {
    const { result, rerender } = await mount('2030-08-05', '2030-08-11');
    await act(async () => {
      result.current.actions.add({ title: 'Bir', date: '2030-08-06', time: null });
      result.current.actions.add({ title: 'İki', date: '2030-08-07', time: null });
    });
    await waitFor(() => expect(result.current.range.tasks).toHaveLength(2));
    const first = result.current;

    // A re-render with nothing new: everything is the same object.
    await rerender({ from: '2030-08-05', to: '2030-08-11' });
    expect(result.current.range).toBe(first.range);
    expect(result.current.open).toBe(first.open);
    expect(result.current.actions).toBe(first.actions);
    expect(result.current.data).toBe(first.data);

    // One task changes: new arrays, the other task keeps its object.
    const [one, two] = first.range.tasks;
    await act(async () => result.current.actions.setDone(two.id, true));
    await waitFor(() => expect(result.current.range.tasks[1].done).toBe(true));
    expect(result.current.range.tasks[0]).toBe(one);
    expect(result.current.open.find((t) => t.id === one.id)).toBe(one);
  });

  it('keeps exactly one live subscription per hook: unsubscribes on range switch and unmount', async () => {
    const repo = backend.repository({ uid: 'local', name: null, email: null, photoURL: null });
    let active = 0;
    const track = <A extends unknown[]>(fn: (...a: A) => () => void) => (...a: A) => {
      const off = fn(...a);
      active++;
      let done = false;
      return () => {
        if (!done) active--;
        done = true;
        off();
      };
    };
    const origRange = repo.subscribeRange;
    const origOpen = repo.subscribeOpen;
    const range = jest.spyOn(repo, 'subscribeRange').mockImplementation(track(origRange));
    const open = jest.spyOn(repo, 'subscribeOpen').mockImplementation(track(origOpen));
    try {
      const { result, rerender, unmount } = await mount('2030-07-01', '2030-07-07');
      expect(result.current.data.repo).toBe(repo);
      expect(active).toBe(2);
      await rerender({ from: '2030-07-08', to: '2030-07-14' });
      expect(active).toBe(2);
      await unmount();
      expect(active).toBe(0);
    } finally {
      range.mockRestore();
      open.mockRestore();
    }
  });
});
