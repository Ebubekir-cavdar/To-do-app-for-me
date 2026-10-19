/// <reference types="jest" />
/**
 * Failed tasks end to end on the Firebase repository over the in-memory Firestore
 * (backend/testing/mockFirestore): the data hooks follow setFailed / setDone (their instant,
 * optimistic display is covered by optimisticDone.test), the stored document keeps failed ⇒ !done, `failed` is only stored while true, and documents
 * written before the field existed read as not failed.
 */
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import type { FirestoreMock } from '../../backend/testing/mockFirestore';
import { isOverdue } from '../../lib/tasks';
import { DataProvider, useOpenTasks, useTaskActions, useTasksInRange } from '../DataProvider';

jest.mock('@react-native-firebase/firestore', () => require('../../backend/testing/mockFirestore').createFirestoreMock());
jest.mock('../../backend', () => {
  const { createFirestoreRepository } = require('../../backend/firebase/firestoreRepository');
  const user = { uid: 'u1', name: 'U', email: null, photoURL: null };
  return {
    backend: {
      mode: 'firebase',
      onAuthChanged: (cb: (u: unknown) => void) => { cb(user); return () => {}; },
      signIn: async () => {},
      signOut: async () => {},
      repository: (u: { uid: string }) => createFirestoreRepository(u.uid),
    },
  };
});

const FS = jest.requireMock('@react-native-firebase/firestore') as FirestoreMock;
const COL = 'users/u1/tasks';
const TODAY = '2026-10-20';
/** A document as an older app version wrote it: no `failed` field. */
const legacy = (id: string, date: string, done = false) =>
  ({ id, title: 'Batu ile buluş ' + id, date, time: null, done, createdAt: 1, categoryId: null, recurrenceId: null });

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;
const doc = (id: string) => FS.store.get(`${COL}/${id}`)!;

async function mount() {
  FS.reset();
  FS.seed(COL, [legacy('a', '2026-10-19'), legacy('b', '2026-10-19'), legacy('c', '2026-10-21', true)]);
  const r = await renderHook(
    () => ({ range: useTasksInRange('2026-10-19', '2026-10-25'), open: useOpenTasks(), actions: useTaskActions() }),
    { wrapper },
  );
  await waitFor(() => expect(r.result.current.range.loading).toBe(false));
  await waitFor(() => expect(r.result.current.open).toHaveLength(2));
  return r;
}

const get = (r: Awaited<ReturnType<typeof mount>>, id: string) => r.result.current.range.tasks.find((t) => t.id === id)!;

it('reads documents without `failed` as not failed', async () => {
  const r = await mount();
  expect(r.result.current.range.tasks.map((t) => t.failed)).toEqual([false, false, false]);
  expect(isOverdue(get(r, 'a'), TODAY)).toBe(true);
});

it('setFailed: stays in the open list, no longer overdue; stored as failed:true, done:false', async () => {
  const r = await mount();
  const b = get(r, 'b');
  await act(async () => { r.result.current.actions.setFailed('a', true); });
  expect(get(r, 'a')).toMatchObject({ failed: true, done: false });
  expect(isOverdue(get(r, 'a'), TODAY)).toBe(false);
  expect(r.result.current.open.map((t) => t.id)).toEqual(['a', 'b']);
  expect(r.result.current.open[0]).toBe(get(r, 'a')); // one object in both lists
  expect(get(r, 'b')).toBe(b); // untouched task keeps its object
  expect(doc('a')).toMatchObject({ failed: true, done: false });

  // Un-fail deletes the field again.
  await act(async () => { r.result.current.actions.setFailed('a', false); });
  expect('failed' in doc('a')).toBe(false);
  expect(get(r, 'a').failed).toBe(false);
  expect(isOverdue(get(r, 'a'), TODAY)).toBe(true);
});

it('setDone(true) on a failed task clears failed in the same update (field deleted)', async () => {
  const r = await mount();
  await act(async () => { r.result.current.actions.setFailed('a', true); });
  const updates = (FS.updateDoc as unknown as jest.Mock).mock.calls.length;
  await act(async () => { r.result.current.actions.setDone('a', true); });
  expect(get(r, 'a')).toMatchObject({ done: true, failed: false });
  expect(r.result.current.open.map((t) => t.id)).toEqual(['b']);
  expect((FS.updateDoc as unknown as jest.Mock).mock.calls.length).toBe(updates + 1);
  expect(doc('a').done).toBe(true);
  expect('failed' in doc('a')).toBe(false);
  expect(get(r, 'a')).toMatchObject({ done: true, failed: false });
});

it('failing a done task un-does it (failed ⇒ !done) and puts it back into the open list', async () => {
  const r = await mount();
  await act(async () => { r.result.current.actions.setFailed('c', true); });
  expect(doc('c')).toMatchObject({ done: false, failed: true });
  expect(get(r, 'c')).toMatchObject({ done: false, failed: true });
  expect(r.result.current.open.map((t) => t.id).sort()).toEqual(['a', 'b', 'c']);
});
