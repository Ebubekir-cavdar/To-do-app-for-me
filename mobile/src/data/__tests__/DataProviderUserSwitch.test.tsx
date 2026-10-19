/// <reference types="jest" />
/**
 * Account changes: the data hooks must never show one user's tasks while another user
 * (or nobody) is signed in, even before the new user's first snapshot arrives.
 */
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { Task } from '../../model/task';
import type { AppUser, TaskRepository } from '../types';
import { DataProvider, useData, useOpenTasks, useTasksInRange } from '../DataProvider';

type Sub = { kind: 'range' | 'open'; cb: (t: Task[]) => void; active: boolean };

jest.mock('../../backend', () => {
  const state: any = { authCb: null, subs: {} };
  // A repository that only delivers snapshots when the test pushes them (like a slow server).
  const makeRepo = (uid: string) => {
    const list: any[] = (state.subs[uid] ||= []);
    const sub = (kind: string) => (...args: any[]) => {
      const s = { kind, cb: args[args.length - 1], active: true };
      list.push(s);
      return () => { s.active = false; };
    };
    return { subscribeRange: sub('range'), subscribeOpen: sub('open'), add: jest.fn(), setDone: jest.fn(), remove: jest.fn() };
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
  __state: { authCb: ((u: AppUser | null) => void) | null; subs: Record<string, Sub[]> };
};

const user = (uid: string): AppUser => ({ uid, name: uid, email: null, photoURL: null });
const task = (id: string, uid: string): Task => ({
  id,
  title: `${uid}'s task`,
  date: '2026-10-15',
  time: null,
  done: false,
  failed: false,
  createdAt: 1,
  categoryId: null,
  recurrenceId: null,
});

async function push(uid: string, tasks: Task[]) {
  await act(async () => {
    for (const s of mock.__state.subs[uid] ?? []) if (s.active) s.cb(tasks);
  });
}
async function signInAs(u: AppUser | null) {
  await act(async () => mock.__state.authCb!(u));
}

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;

it('does not leak the previous user’s tasks into the next user’s view', async () => {
  const { result } = await renderHook(
    () => ({ range: useTasksInRange('2026-10-12', '2026-10-18'), open: useOpenTasks(), data: useData() }),
    { wrapper },
  );
  expect(result.current.data.status).toBe('signedOut');
  expect(result.current.range).toEqual({ tasks: [], loading: true });

  await signInAs(user('alice'));
  await push('alice', [task('a1', 'alice')]);
  expect(result.current.range.tasks.map((t) => t.id)).toEqual(['a1']);
  expect(result.current.open.map((t) => t.id)).toEqual(['a1']);
  const aliceRepo: TaskRepository | null = result.current.data.repo;

  // Another account becomes current before its first snapshot has arrived.
  await signInAs(user('bob'));
  expect(result.current.data.repo).not.toBe(aliceRepo);
  expect(result.current.range).toEqual({ tasks: [], loading: true });
  expect(result.current.open).toEqual([]);
  // Alice's listeners were closed.
  expect(mock.__state.subs.alice.every((s) => !s.active)).toBe(true);

  await push('bob', [task('b1', 'bob')]);
  expect(result.current.range.tasks.map((t) => t.id)).toEqual(['b1']);
  expect(result.current.open.map((t) => t.id)).toEqual(['b1']);

  // Signing out clears the view too.
  await signInAs(null);
  expect(result.current.data.status).toBe('signedOut');
  expect(result.current.data.repo).toBeNull();
  expect(result.current.range.tasks).toEqual([]);
  expect(result.current.open).toEqual([]);
  expect(mock.__state.subs.bob.every((s) => !s.active)).toBe(true);
});

it('keeps the same repository (and data) while the same user stays signed in', async () => {
  const { result } = await renderHook(() => ({ range: useTasksInRange('2026-10-12', '2026-10-18'), data: useData() }), {
    wrapper,
  });
  await signInAs(user('carol'));
  await push('carol', [task('c1', 'carol')]);
  const repo = result.current.data.repo;
  // e.g. a token refresh / profile update re-emits the same uid
  await signInAs({ ...user('carol'), name: 'Carol B.' });
  expect(result.current.data.repo).toBe(repo);
  expect(result.current.range.tasks.map((t) => t.id)).toEqual(['c1']);
});

it('an auth re-emit with identical fields keeps the same user object and context value', async () => {
  const { result } = await renderHook(() => useData(), { wrapper });
  await signInAs(user('dan'));
  const first = result.current;
  await signInAs(user('dan'));
  expect(result.current).toBe(first);
  expect(result.current.user).toBe(first.user);
  await signInAs({ ...user('dan'), photoURL: 'p' });
  expect(result.current.user?.photoURL).toBe('p');
  expect(result.current.repo).toBe(first.repo);
});
