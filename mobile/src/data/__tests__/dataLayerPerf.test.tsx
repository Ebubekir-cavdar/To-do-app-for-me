/// <reference types="jest" />
/**
 * Data-layer work budget: the week screen's data hooks + NotificationsProvider mounted on the
 * Firebase repository over an in-memory Firestore (see backend/testing/mockFirestore), with
 * expo-notifications mocked by an in-memory OS schedule. Counts, per scenario, the Firestore
 * listeners opened, snapshots crossing the bridge, documents deserialized, Task objects allocated,
 * consumer re-renders and native notification calls — and fails if any regresses past its budget.
 *
 * Run with PERF_REPORT=1 to print the table.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render } from '@testing-library/react-native';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as taskDoc from '../../backend/firebase/taskDoc';
import type { FirestoreMock } from '../../backend/testing/mockFirestore';
import { addDays, parseYmd, ymd } from '../../lib/dates';
import type { Task } from '../../model/task';
import { NotificationsProvider } from '../../notifications';
import * as plan from '../../notifications/plan';
import type { ExpoNotificationsMock } from '../../notifications/testing/mockExpoNotifications';
import { DataProvider, useOpenTasks, useTaskActions, useTasksInRange } from '../DataProvider';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () => require('../../notifications/testing/mockExpoNotifications').createMock());
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
const N = jest.requireMock('expo-notifications') as ExpoNotificationsMock;
(Platform as { OS: string }).OS = 'android';

// Wednesday 14 Oct 2026, 08:00 — current week starts Mon 12 Oct.
const NOW = new Date(2026, 9, 14, 8, 0, 0);
const MONDAY = '2026-10-12';
const TOMORROW = ymd(addDays(NOW, 1));

/** ~100 tasks from 3 weeks back to 4 weeks ahead: past ones mostly done, a few overdue. */
function seedDocs(): Task[] {
  const out: Task[] = [];
  let n = 0;
  for (let off = -21; off <= 27; off++) {
    const date = ymd(addDays(NOW, off));
    const past = off < 0;
    out.push({ id: `t${String(++n).padStart(3, '0')}`, title: `Saatli ${n}`, date, time: off % 2 ? '18:00' : '07:30', done: past && off % 5 !== 0, failed: false, createdAt: n, categoryId: null, recurrenceId: null });
    out.push({ id: `t${String(++n).padStart(3, '0')}`, title: `Görev ${n}`, date, time: null, done: past, failed: false, createdAt: n, categoryId: null, recurrenceId: null });
  }
  return out;
}

/* ---------- counters ---------- */
const seenTasks = new WeakSet<object>();
let tasksAllocated = 0;
let weekRenders = 0;
let plans = 0;
const probe = {} as { actions: ReturnType<typeof useTaskActions> };

function WeekProbe({ mon }: { mon: string }) {
  // Exactly the week screen's data usage (src/app/index.tsx): a 3-week window + open tasks.
  const start = parseYmd(mon);
  const { tasks } = useTasksInRange(ymd(addDays(start, -7)), ymd(addDays(start, 13)));
  const open = useOpenTasks();
  const actions = useTaskActions();
  weekRenders++;
  useEffect(() => { probe.actions = actions; });
  void tasks;
  void open;
  return null;
}

const tree = (mon: string) => (
  <DataProvider>
    <NotificationsProvider>
      <WeekProbe mon={mon} />
    </NotificationsProvider>
  </DataProvider>
);

const flush = () => act(async () => { await new Promise<void>((r) => setImmediate(r)); });
async function settle(ms = 3000) {
  for (let t = 0; t < ms; t += 250) {
    await act(async () => { jest.advanceTimersByTime(250); });
    await flush();
  }
  await flush();
}

type Row = {
  listenersOpened: number;
  listenersActive: number;
  snapshots: number;
  docsDeserialized: number;
  tasksAllocated: number;
  weekRenders: number;
  plans: number;
  nativeGetAll: number;
  nativeSchedule: number;
  nativeCancel: number;
  nativeOther: number;
};

function resetCounters() {
  FS.resetStats();
  tasksAllocated = 0;
  weekRenders = 0;
  plans = 0;
  N.getAllScheduledNotificationsAsync.mockClear();
  N.scheduleNotificationAsync.mockClear();
  N.cancelScheduledNotificationAsync.mockClear();
  N.cancelAllScheduledNotificationsAsync.mockClear();
  N.setNotificationChannelAsync.mockClear();
  N.getPermissionsAsync.mockClear();
}

function read(): Row {
  return {
    listenersOpened: FS.stats.listenersCreated,
    listenersActive: FS.stats.listenersActive,
    snapshots: FS.stats.snapshotsDelivered,
    docsDeserialized: FS.stats.docsDeserialized,
    tasksAllocated,
    weekRenders,
    plans,
    nativeGetAll: N.getAllScheduledNotificationsAsync.mock.calls.length,
    nativeSchedule: N.scheduleNotificationAsync.mock.calls.length,
    nativeCancel: N.cancelScheduledNotificationAsync.mock.calls.length + N.cancelAllScheduledNotificationsAsync.mock.calls.length,
    nativeOther: N.setNotificationChannelAsync.mock.calls.length + N.getPermissionsAsync.mock.calls.length,
  };
}

/**
 * Upper bounds = the measured cost after the data-layer optimization (shared listeners, identity
 * reuse, no range listener in the notifications engine, plan memo). Before it, on the same
 * scenario: start 4 listeners / 4 snapshots / 192 Task objects; toggle 4 snapshots / 190 Task
 * objects; add 4 / 194; toggleFar 2 / 118 + a native getAll; weekSwitch 43 Task objects.
 */
const BUDGET: Record<string, Partial<Row>> = {
  start: { listenersOpened: 2, listenersActive: 2, snapshots: 2, docsDeserialized: 102, tasksAllocated: 77, weekRenders: 3, plans: 1, nativeGetAll: 1, nativeSchedule: 27, nativeCancel: 0, nativeOther: 3 },
  toggle: { listenersOpened: 0, snapshots: 2, docsDeserialized: 101, tasksAllocated: 1, weekRenders: 1, plans: 1, nativeGetAll: 1, nativeSchedule: 13, nativeCancel: 14, nativeOther: 0 },
  add: { listenersOpened: 0, snapshots: 2, docsDeserialized: 103, tasksAllocated: 1, weekRenders: 1, plans: 1, nativeGetAll: 1, nativeSchedule: 14, nativeCancel: 13, nativeOther: 0 },
  toggleFar: { listenersOpened: 0, snapshots: 1, docsDeserialized: 59, tasksAllocated: 0, weekRenders: 1, plans: 1, nativeGetAll: 0, nativeSchedule: 0, nativeCancel: 0, nativeOther: 0 },
  weekSwitch: { listenersOpened: 1, listenersActive: 2, snapshots: 1, docsDeserialized: 43, tasksAllocated: 5, weekRenders: 2, plans: 0, nativeGetAll: 0, nativeSchedule: 0, nativeCancel: 0, nativeOther: 0 },
  idle10min: { listenersOpened: 0, snapshots: 0, docsDeserialized: 0, tasksAllocated: 0, weekRenders: 0, plans: 0, nativeGetAll: 0, nativeSchedule: 0, nativeCancel: 0, nativeOther: 0 },
};

const results: Record<string, Row> = {};

beforeAll(() => {
  const orig = taskDoc.docToTask;
  jest.spyOn(taskDoc, 'docToTask').mockImplementation((...args: Parameters<typeof orig>) => {
    const t = orig(...args);
    if (t && !seenTasks.has(t)) {
      seenTasks.add(t);
      tasksAllocated++;
    }
    return t;
  });
  const origPlan = plan.planNotifications;
  jest.spyOn(plan, 'planNotifications').mockImplementation((...args: Parameters<typeof origPlan>) => {
    plans++;
    return origPlan(...args);
  });
});

afterAll(() => {
  if (process.env.PERF_REPORT) console.log(JSON.stringify(results, null, 1));
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it('stays within the data-layer work budget: start, toggle, add, far toggle, week switch, idle', async () => {
  jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'], now: NOW });
  await AsyncStorage.clear();
  N.reset();
  FS.reset();
  FS.seed('users/u1/tasks', seedDocs() as unknown as Record<string, unknown>[]);

  const phase = async (name: string, run: () => Promise<void>) => {
    resetCounters();
    await run();
    await settle();
    results[name] = read();
  };

  let r: Awaited<ReturnType<typeof render>> | null = null;
  await phase('start', async () => { r = await render(tree(MONDAY)); });
  // Sanity: the schedule was built.
  expect(N.store.has('gd:rem:' + seedDocs().find((t) => t.date === TOMORROW && t.time)!.id)).toBe(true);
  expect([...N.store.keys()].filter((k) => k.startsWith('gd:daily:'))).toHaveLength(14);

  const timedTomorrow = seedDocs().find((t) => t.date === TOMORROW && t.time)!;
  await phase('toggle', async () => { await act(async () => { probe.actions.setDone(timedTomorrow.id, true); }); });
  expect(N.store.has('gd:rem:' + timedTomorrow.id)).toBe(false);

  await phase('add', async () => { await act(async () => { probe.actions.add({ title: 'Toplantı', date: TOMORROW, time: '10:00' }); }); });
  expect([...N.store.values()].some((x) => x.content.body === '«Toplantı» yarım saat sonra başlıyor (10:00).')).toBe(true);

  // A task beyond the 14-day window: no notification changes.
  const far = seedDocs().find((t) => t.date === ymd(addDays(NOW, 20)) && !t.time)!;
  await phase('toggleFar', async () => { await act(async () => { probe.actions.setDone(far.id, true); }); });

  await phase('weekSwitch', async () => { await r!.rerender(tree(ymd(addDays(parseYmd(MONDAY), 7)))); });

  await phase('idle10min', async () => { await settle(10 * 60000); });

  const over: string[] = [];
  for (const [name, budget] of Object.entries(BUDGET)) {
    for (const [k, max] of Object.entries(budget)) {
      const v = results[name][k as keyof Row];
      if (v > (max as number)) over.push(`${name}.${k}: ${v} > ${max}`);
    }
  }
  expect(over).toEqual([]);
  await act(async () => { r!.unmount(); });
});
