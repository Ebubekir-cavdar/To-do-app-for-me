/// <reference types="jest" />
/**
 * NotificationsProvider end to end on the local backend, with expo-notifications mocked by an
 * in-memory OS schedule (see ../testing/mockExpoNotifications).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { DataProvider, useTaskActions } from '../../data/DataProvider';
import { addDays, ymd } from '../../lib/dates';
import type { Task } from '../../model/task';
import {
  ASKED_KEY,
  emitNotificationOpen,
  NotificationsProvider,
  SETTINGS_KEY,
  useNotificationOpen,
  useNotifications,
  type NotificationsApi,
} from '../index';
import { CHANNEL_DAILY, CHANNEL_REMINDERS, TEST_ID } from '../plan';
import { tapResponse, type ExpoNotificationsMock } from '../testing/mockExpoNotifications';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-notifications', () => require('../testing/mockExpoNotifications').createMock());
const N = jest.requireMock('expo-notifications') as ExpoNotificationsMock;

// Channels are Android-only; the engine checks Platform.OS when creating them.
(Platform as { OS: string }).OS = 'android';

const WAIT = { timeout: 6000 };
jest.setTimeout(20000);

const tomorrow = ymd(addDays(new Date(), 1));
const yesterday = ymd(addDays(new Date(), -1));
const SEED: Task[] = [
  { id: 'gym', title: 'Spor salonu', date: tomorrow, time: '18:00', done: false, failed: false, createdAt: 1, categoryId: null, recurrenceId: null },
  { id: 'market', title: 'Market alışverişi', date: tomorrow, time: null, done: false, failed: false, createdAt: 2, categoryId: null, recurrenceId: null },
  { id: 'old', title: 'Eski iş', date: yesterday, time: null, done: false, failed: false, createdAt: 3, categoryId: null, recurrenceId: null },
];

const probe = {} as { api: NotificationsApi; actions: ReturnType<typeof useTaskActions> };
const opened = jest.fn();

function Probe() {
  const api = useNotifications();
  const actions = useTaskActions();
  useNotificationOpen(opened);
  useEffect(() => {
    probe.api = api;
    probe.actions = actions;
  });
  return null;
}

const tree = () => (
  <DataProvider>
    <NotificationsProvider>
      <Probe />
    </NotificationsProvider>
  </DataProvider>
);

const ids = () => [...N.store.keys()].sort();

beforeAll(async () => {
  await AsyncStorage.setItem('todoapp.tasks.v1', JSON.stringify(SEED));
});

beforeEach(async () => {
  N.reset();
  jest.clearAllMocks();
  await AsyncStorage.multiRemove([SETTINGS_KEY, ASKED_KEY]);
});

it('creates both channels, installs a foreground handler, and schedules summaries + reminders', async () => {
  await render(tree());
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);

  expect(N.channels.get(CHANNEL_DAILY)).toMatchObject({ name: 'Sabah özeti', importance: 4, sound: null, enableVibrate: false });
  expect(N.channels.get(CHANNEL_REMINDERS)).toMatchObject({
    name: 'Görev hatırlatmaları',
    importance: 6,
    sound: 'hatirlatma.mp3',
    enableVibrate: true,
  });

  const rem = N.store.get('gd:rem:gym')!;
  expect(rem.content.body).toBe('«Spor salonu» yarım saat sonra başlıyor (18:00).');
  expect(rem.trigger).toMatchObject({ type: 'date', channelId: CHANNEL_REMINDERS });
  const at = (rem.trigger as { date: Date }).date;
  expect([at.getHours(), at.getMinutes()]).toEqual([17, 30]);

  const daily = N.store.get('gd:daily:' + tomorrow)!;
  expect(daily.content.body).toBe('• 18:00 Spor salonu\n• Market alışverişi\n⚠ 1 geciken görev');
  expect(ids().filter((i) => i.startsWith('gd:daily:')).length).toBeGreaterThanOrEqual(13);

  // Foreground behaviour: reminders pop with sound, the summary stays quiet.
  const h = N.handler as { handleNotification: (n: unknown) => Promise<Record<string, unknown>> };
  const notif = (kind: string) => ({ request: { content: { data: { kind } } } });
  expect(await h.handleNotification(notif('reminder'))).toMatchObject({ shouldShowBanner: true, shouldPlaySound: true, shouldShowList: true });
  expect(await h.handleNotification(notif('daily'))).toMatchObject({ shouldShowBanner: false, shouldPlaySound: false, shouldShowList: true });
});

it('re-syncs when a task is done, edited or added, without touching unchanged items', async () => {
  await render(tree());
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
  N.scheduleNotificationAsync.mockClear();

  await act(async () => { probe.actions.setDone('gym', true); });
  try {
    await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(false), WAIT);
    // Its reminder is gone; tomorrow's summary drops it, later summaries no longer count it as
    // (predicted) overdue. No reminder was rescheduled.
    const rescheduled = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier as string);
    expect(rescheduled).toContain('gd:daily:' + tomorrow);
    expect(rescheduled.every((i) => i.startsWith('gd:daily:') && i >= 'gd:daily:' + tomorrow)).toBe(true);
    expect(N.store.get('gd:daily:' + tomorrow)!.content.body).toBe('• Market alışverişi\n⚠ 1 geciken görev');
  } finally {
    await act(async () => { probe.actions.setDone('gym', false); });
  }
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);

  await act(async () => { probe.actions.add({ title: 'Toplantı', date: tomorrow, time: '10:00' }); });
  await waitFor(() => expect([...N.store.values()].some((r) => r.content.body === '«Toplantı» yarım saat sonra başlıyor (10:00).')).toBe(true), WAIT);
});

it('asks once: undetermined → shouldAskPermission; nothing scheduled until granted', async () => {
  N.permission = { status: 'undetermined', granted: false };
  await render(tree());
  await waitFor(() => expect(probe.api.shouldAskPermission).toBe(true), WAIT);
  expect(probe.api.permission).toBe('undetermined');
  await waitFor(() => expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalled(), WAIT);
  expect(N.store.size).toBe(0);

  let granted = false;
  await act(async () => { granted = await probe.api.requestPermission(); });
  expect(granted).toBe(true);
  expect(N.requestPermissionsAsync).toHaveBeenCalled();
  expect(probe.api.permission).toBe('granted');
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);

  await act(async () => { probe.api.markAsked(); });
  expect(probe.api.shouldAskPermission).toBe(false);
  expect(await AsyncStorage.getItem(ASKED_KEY)).toBe('1');
});

it('does not ask again once the explainer was answered, and maps a refusal to denied', async () => {
  await AsyncStorage.setItem(ASKED_KEY, '1');
  N.permission = { status: 'undetermined', granted: false };
  N.requestResult = 'denied';
  await render(tree());
  await waitFor(() => expect(probe.api.permission).toBe('undetermined'), WAIT);
  expect(probe.api.shouldAskPermission).toBe(false);
  let granted = true;
  await act(async () => { granted = await probe.api.requestPermission(); });
  expect(granted).toBe(false);
  expect(probe.api.permission).toBe('denied');
});

it('settings: defaults on, toggles persist and cancel that kind', async () => {
  await render(tree());
  expect(probe.api.settings).toEqual({ daily: true, reminders: true });
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);

  await act(async () => { probe.api.setSettings({ reminders: false }); });
  expect(probe.api.settings).toEqual({ daily: true, reminders: false });
  expect(JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY))!)).toEqual({ daily: true, reminders: false });
  await waitFor(() => expect(ids().some((i) => i.startsWith('gd:rem:'))).toBe(false), WAIT);
  expect(ids().some((i) => i.startsWith('gd:daily:'))).toBe(true);
});

it('reads stored settings before the first sync', async () => {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ daily: false, reminders: true }));
  await render(tree());
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
  expect(probe.api.settings).toEqual({ daily: false, reminders: true });
  expect(ids().some((i) => i.startsWith('gd:daily:'))).toBe(false);
});

it('unmounting (sign-out) cancels everything', async () => {
  const r = await render(tree());
  await waitFor(() => expect(N.store.size).toBeGreaterThan(0), WAIT);
  N.cancelAllScheduledNotificationsAsync.mockClear();
  await act(async () => { r.unmount(); });
  await waitFor(() => expect(N.cancelAllScheduledNotificationsAsync).toHaveBeenCalled(), WAIT);
  expect(N.store.size).toBe(0);
});

it('re-checks permission when the app returns to the foreground', async () => {
  // AppState.addEventListener is a jest.fn() in the RN preset: swap it (not spyOn, whose
  // mockRestore would wipe the preset's implementation for later tests) and put it back.
  const original = AppState.addEventListener;
  let onChange: ((s: AppStateStatus) => void)[] = [];
  AppState.addEventListener = ((_t: string, h: (s: AppStateStatus) => void) => {
    onChange.push(h);
    return { remove: () => { onChange = onChange.filter((x) => x !== h); } };
  }) as unknown as typeof AppState.addEventListener;
  const r = await render(tree());
  try {
    await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
    // The user turned notifications off in system settings.
    N.permission = { status: 'denied', granted: false };
    await act(async () => { onChange.forEach((h) => h('active')); });
    await waitFor(() => expect(probe.api.permission).toBe('denied'), WAIT);
    await waitFor(() => expect(N.store.size).toBe(0), WAIT);
  } finally {
    await act(async () => { r.unmount(); });
    AppState.addEventListener = original;
  }
});

it('skips the native round-trip when the plan did not change, but re-syncs fully on returning to the foreground', async () => {
  const original = AppState.addEventListener;
  let onChange: ((s: AppStateStatus) => void)[] = [];
  AppState.addEventListener = ((_t: string, h: (s: AppStateStatus) => void) => {
    onChange.push(h);
    return { remove: () => { onChange = onChange.filter((x) => x !== h); } };
  }) as unknown as typeof AppState.addEventListener;
  const r = await render(tree());
  try {
    await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
    await waitFor(() => expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1), WAIT);

    // A task far beyond the 14-day window: the open tasks change, the plan does not.
    const far = ymd(addDays(new Date(), 40));
    await act(async () => { probe.actions.add({ title: 'Uzak', date: far, time: '10:00' }); });
    await act(async () => { await new Promise((res) => setTimeout(res, 2200)); });
    expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);

    // Something outside the app changed the OS schedule; coming back to the foreground repairs it.
    N.store.delete('gd:rem:gym');
    await act(async () => { onChange.forEach((h) => h('active')); });
    await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
    expect(N.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);

    // A real change after that is applied as usual.
    await act(async () => { probe.actions.add({ title: 'Yakın', date: tomorrow, time: '11:00' }); });
    await waitFor(() => expect([...N.store.values()].some((x) => x.content.body === '«Yakın» yarım saat sonra başlıyor (11:00).')).toBe(true), WAIT);
  } finally {
    await act(async () => { r.unmount(); });
    AppState.addEventListener = original;
  }
});

it('a tap while running jumps to today (once per tap)', async () => {
  await render(tree());
  await waitFor(() => expect(N.responseListeners.size).toBe(1), WAIT);
  const tap = tapResponse('gd:rem:gym', 1000);
  await act(async () => { N.responseListeners.forEach((l) => l(tap)); });
  expect(opened).toHaveBeenCalledTimes(1);
  await act(async () => { N.responseListeners.forEach((l) => l(tap)); });
  expect(opened).toHaveBeenCalledTimes(1);
  // A non-default action (e.g. a button) is not a "tap".
  await act(async () => { N.responseListeners.forEach((l) => l({ ...tapResponse('x', 2000), actionIdentifier: 'other' })); });
  expect(opened).toHaveBeenCalledTimes(1);
});

it('an app launched by a tap jumps to today and clears the launch response', async () => {
  N.lastResponse = tapResponse('gd:daily:' + tomorrow, 5000);
  await render(tree());
  await waitFor(() => expect(opened).toHaveBeenCalledTimes(1), WAIT);
  expect(N.clearLastNotificationResponse).toHaveBeenCalled();
});

it('a tap before any screen subscribed is delivered to the first subscriber', async () => {
  emitNotificationOpen();
  const late = jest.fn();
  function Late() { useNotificationOpen(late); return null; }
  await render(<Late />);
  expect(late).toHaveBeenCalledTimes(1);
});

it('sendTestReminder schedules a sample reminder in ~3 s on the reminders channel', async () => {
  await render(tree());
  await act(async () => { await probe.api.sendTestReminder(); });
  const req = N.store.get(TEST_ID)!;
  expect(req.trigger).toEqual({ type: 'timeInterval', seconds: 3, channelId: CHANNEL_REMINDERS });
  expect(req.content).toMatchObject({ title: '⚔ Ulak geldi!', sound: 'hatirlatma.mp3' });
  expect(req.content.body).toMatch(/^«Deneme seferi» yarım saat sonra başlıyor \(\d\d:\d\d\)\.$/);
  // The sync engine leaves the test reminder alone.
  await waitFor(() => expect(N.store.has('gd:rem:gym')).toBe(true), WAIT);
  expect(N.store.has(TEST_ID)).toBe(true);
});
