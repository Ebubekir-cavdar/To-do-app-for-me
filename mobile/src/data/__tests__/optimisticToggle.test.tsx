/// <reference types="jest" />
/**
 * Instant checkbox toggles through the data hooks: useTaskActions().setDone updates
 * useTasksInRange and useOpenTasks in the same act, before the repository's snapshot arrives,
 * reverts (and reports) a failed write, and never carries over to another user.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Task } from '../../model/task';
import type { AppUser } from '../types';
import { DataProvider, useOpenTasks, useTaskActions, useTasksInRange } from '../DataProvider';

type Sub = { kind: 'range' | 'open'; cb: (t: Task[]) => void; active: boolean };
type Write = { id: string; done: boolean; resolve: () => void; reject: (e: unknown) => void };

jest.mock('../../backend', () => {
  const state: any = { authCb: null, subs: {}, writes: [] };
  // Snapshots and write results arrive only when the test delivers them (like the native bridge).
  const makeRepo = (uid: string) => {
    const list: any[] = (state.subs[uid] ||= []);
    const sub = (kind: string) => (...args: any[]) => {
      const s = { kind, cb: args[args.length - 1], active: true };
      list.push(s);
      return () => { s.active = false; };
    };
    return {
      subscribeRange: sub('range'),
      subscribeOpen: sub('open'),
      add: jest.fn(),
      addMany: jest.fn(),
      remove: jest.fn(),
      removeSeries: jest.fn(),
      setDone: (id: string, done: boolean) =>
        new Promise<void>((resolve, reject) => { state.writes.push({ id, done, resolve, reject }); }),
    };
  };
  return {
    __state: state,
    backend: {
      mode: 'firebase',
      onAuthChanged: (cb: any) => {
        state.authCb = cb;
        cb(null);
        return () => { state.authCb = null; };
      },
      signIn: async () => {},
      signOut: async () => {},
      repository: (user: any) => makeRepo(user.uid),
    },
  };
});

const mock = jest.requireMock('../../backend') as {
  __state: { authCb: ((u: AppUser | null) => void) | null; subs: Record<string, Sub[]>; writes: Write[] };
};

const user = (uid: string): AppUser => ({ uid, name: uid, email: null, photoURL: null });
const task = (id: string, done = false): Task => ({
  id, title: id, date: '2026-10-15', time: null, done, failed: false, createdAt: 1, categoryId: null, recurrenceId: null,
});

async function push(uid: string, all: Task[]) {
  await act(async () => {
    for (const s of mock.__state.subs[uid] ?? []) {
      if (s.active) s.cb(s.kind === 'open' ? all.filter((t) => !t.done) : all);
    }
  });
}
async function signInAs(u: AppUser | null) {
  await act(async () => mock.__state.authCb!(u));
}

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;
const ids = (l: Task[]) => l.map((t) => t.id);

async function mount() {
  let renders = 0;
  const r = await renderHook(
    () => {
      renders++;
      return { range: useTasksInRange('2026-10-12', '2026-10-18'), open: useOpenTasks(), actions: useTaskActions() };
    },
    { wrapper },
  );
  return { ...r, renders: () => renders };
}

beforeEach(() => {
  mock.__state.writes.length = 0;
});

it('shows the toggle in the same render as the tap, before any snapshot', async () => {
  const { result, renders } = await mount();
  await signInAs(user('ayse'));
  const a = task('a'), b = task('b');
  await push('ayse', [a, b]);

  const before = renders();
  await act(async () => { result.current.actions.setDone('a', true); }); // the repository has sent no snapshot
  expect(renders() - before).toBe(1); // range + open updated in one render
  expect(result.current.range.tasks[0]).toMatchObject({ id: 'a', done: true });
  expect(result.current.range.tasks[1]).toBe(b);
  expect(ids(result.current.open)).toEqual(['b']);
  expect(result.current.open[0]).toBe(b);

  // The snapshot confirming it changes nothing on screen.
  const shown = result.current.range.tasks[0];
  const n = renders();
  await push('ayse', [task('a', true), b]);
  await act(async () => { mock.__state.writes[0].resolve(); });
  expect(renders()).toBe(n);
  expect(result.current.range.tasks[0]).toBe(shown);
});

it('reverts a failed write and reports it through the usual warning', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const { result } = await mount();
    await signInAs(user('berk'));
    const a = task('a');
    await push('berk', [a]);
    await act(async () => { result.current.actions.setDone('a', true); });
    expect(result.current.range.tasks[0].done).toBe(true);
    expect(result.current.open).toEqual([]);

    const err = new Error('permission-denied');
    await act(async () => { mock.__state.writes[0].reject(err); });
    expect(result.current.range.tasks[0]).toBe(a);
    expect(result.current.open[0]).toBe(a);
    expect(warn).toHaveBeenCalledWith('[tasks] write failed', err);
  } finally {
    warn.mockRestore();
  }
});

it('a pending toggle does not follow the user out: the next account starts clean', async () => {
  const { result } = await mount();
  await signInAs(user('cem'));
  await push('cem', [task('a')]);
  await act(async () => { result.current.actions.setDone('a', true); });
  expect(result.current.range.tasks[0].done).toBe(true);

  await signInAs(null);
  await signInAs(user('cem')); // same account again: a new repository, no overlay
  await push('cem', [task('a')]);
  expect(result.current.range.tasks[0].done).toBe(false);
  expect(ids(result.current.open)).toEqual(['a']);
});
