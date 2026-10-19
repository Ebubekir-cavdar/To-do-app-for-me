/// <reference types="jest" />
import type { Task } from '../../model/task';
import { CHANNEL_DAILY, CHANNEL_REMINDERS, planNotifications, TEST_ID, type PlannedNotification } from '../plan';
import type { ExpoNotificationsMock } from '../testing/mockExpoNotifications';
import { diffSchedule, planKey, signature, syncSchedule, toRequest, type SchedulerApi } from '../sync';

// In-memory OS schedule standing in for expo-notifications.
jest.mock('expo-notifications', () => require('../testing/mockExpoNotifications').createMock());
const N = jest.requireMock('expo-notifications') as ExpoNotificationsMock;
const mockStore = N.store;

let seq = 0;
function task(p: Partial<Task> & { date: string }): Task {
  seq++;
  return { id: 't' + seq, title: 'Görev ' + seq, time: null, done: false, failed: false, createdAt: seq, categoryId: null, recurrenceId: null, ...p };
}
const NOW = new Date(2026, 9, 17, 8, 0);
const ON = { daily: true, reminders: true };

function p(id: string, body = 'x', at = new Date(2026, 9, 18, 9)): PlannedNotification {
  return { id, at, channel: CHANNEL_DAILY, title: 'T', body, data: { kind: 'daily', ymd: '2026-10-18' } };
}
const scheduledOf = (x: PlannedNotification) => ({ identifier: x.id, content: { data: { ...x.data, sig: signature(x) } } });

beforeEach(() => {
  seq = 0;
  N.reset();
  jest.clearAllMocks();
});

describe('diffSchedule', () => {
  it('schedules everything when nothing is scheduled', () => {
    const plan = [p('gd:a'), p('gd:b')];
    expect(diffSchedule(plan, [])).toEqual({ cancel: [], schedule: plan });
  });

  it('does nothing when the schedule already matches', () => {
    const plan = [p('gd:a'), p('gd:b')];
    expect(diffSchedule(plan, plan.map(scheduledOf))).toEqual({ cancel: [], schedule: [] });
  });

  it('replaces an item whose content changed under the same id', () => {
    const old = p('gd:a', 'eski');
    const now = p('gd:a', 'yeni');
    expect(diffSchedule([now], [scheduledOf(old)])).toEqual({ cancel: ['gd:a'], schedule: [now] });
  });

  it('replaces an item whose time changed', () => {
    const old = p('gd:a', 'x', new Date(2026, 9, 18, 9));
    const now = p('gd:a', 'x', new Date(2026, 9, 18, 10));
    expect(diffSchedule([now], [scheduledOf(old)])).toEqual({ cancel: ['gd:a'], schedule: [now] });
  });

  it('cancels stale ids and entries without a signature, but leaves the test reminder alone', () => {
    const keep = p('gd:a');
    const diff = diffSchedule([keep], [
      scheduledOf(keep),
      scheduledOf(p('gd:gone')),
      { identifier: 'foreign', content: { data: {} } },
      { identifier: TEST_ID, content: { data: { kind: 'test' } } },
    ]);
    expect(diff).toEqual({ cancel: ['gd:gone', 'foreign'], schedule: [] });
  });

  it('copes with missing content/data', () => {
    const a = p('gd:a');
    expect(diffSchedule([a], [{ identifier: 'gd:a', content: null }])).toEqual({ cancel: ['gd:a'], schedule: [a] });
  });
});

describe('toRequest', () => {
  it('reminder: DATE trigger on the reminders channel, custom sound, vibration, gold accent', () => {
    const [r] = planNotifications([task({ date: '2026-10-17', time: '18:00', title: 'Spor salonu' })], [], NOW, { daily: false, reminders: true });
    const req = toRequest(r);
    expect(req.identifier).toBe(r.id);
    expect(req.trigger).toEqual({ type: 'date', date: r.at, channelId: CHANNEL_REMINDERS });
    expect(req.content).toMatchObject({
      title: '⚔ Ulak geldi!',
      body: '«Spor salonu» yarım saat sonra başlıyor (18:00).',
      sound: 'hatirlatma.mp3',
      color: '#d4ad57',
      priority: 'high',
      data: { kind: 'reminder', taskId: r.data.taskId, sig: signature(r) },
    });
    expect(Array.isArray(req.content.vibrate)).toBe(true);
  });

  it('daily summary: silent, no vibration, daily channel', () => {
    const [d] = planNotifications([], [], NOW, { daily: true, reminders: false });
    const req = toRequest(d);
    expect(req.trigger).toEqual({ type: 'date', date: d.at, channelId: CHANNEL_DAILY });
    expect(req.content.sound).toBe(false);
    expect(req.content.vibrate).toBeUndefined();
    expect(req.content.priority).toBe('low');
  });
});

describe('syncSchedule (mocked expo-notifications)', () => {
  it('first sync schedules the whole plan; a second identical sync is a no-op', async () => {
    const tasks = [task({ id: 'a', date: '2026-10-17', time: '18:00' }), task({ id: 'b', date: '2026-10-18', time: '07:00' })];
    const plan = planNotifications(tasks, [], NOW, ON);
    expect(await syncSchedule(plan)).toEqual({ cancelled: 0, scheduled: 16, failed: 0 });
    expect(mockStore.size).toBe(16);
    N.scheduleNotificationAsync.mockClear();
    expect(await syncSchedule(planNotifications(tasks, [], NOW, ON))).toEqual({ cancelled: 0, scheduled: 0, failed: 0 });
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(N.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('editing a task replaces only its reminder and the affected summary', async () => {
    const a = task({ id: 'a', date: '2026-10-18', time: '18:00', title: 'Spor' });
    await syncSchedule(planNotifications([a], [], NOW, ON));
    N.scheduleNotificationAsync.mockClear();
    const edited = { ...a, time: '19:00' };
    const r = await syncSchedule(planNotifications([edited], [], NOW, ON));
    expect(r).toEqual({ cancelled: 2, scheduled: 2, failed: 0 });
    const ids = N.scheduleNotificationAsync.mock.calls.map((c) => c[0].identifier).sort();
    expect(ids).toEqual(['gd:daily:2026-10-18', 'gd:rem:a']);
    expect(mockStore.get('gd:rem:a')!.content.body).toBe('«Spor» yarım saat sonra başlıyor (19:00).');
  });

  it('marking a task done or deleting it cancels its reminder', async () => {
    const a = task({ id: 'a', date: '2026-10-19', time: '18:00' });
    const b = task({ id: 'b', date: '2026-10-19', time: '20:00' });
    await syncSchedule(planNotifications([a, b], [], NOW, ON));
    expect(mockStore.has('gd:rem:a')).toBe(true);
    await syncSchedule(planNotifications([{ ...a, done: true }, b], [], NOW, ON));
    expect(mockStore.has('gd:rem:a')).toBe(false);
    expect(mockStore.has('gd:rem:b')).toBe(true);
    await syncSchedule(planNotifications([], [], NOW, ON));
    expect(mockStore.has('gd:rem:b')).toBe(false);
    expect([...mockStore.keys()].every((k) => k.startsWith('gd:daily:'))).toBe(true);
  });

  it('turning a setting off cancels that kind; an empty plan clears everything but the test', async () => {
    const tasks = [task({ id: 'a', date: '2026-10-19', time: '18:00' })];
    await syncSchedule(planNotifications(tasks, [], NOW, ON));
    mockStore.set(TEST_ID, { identifier: TEST_ID, content: { data: { kind: 'test' } }, trigger: null });
    await syncSchedule(planNotifications(tasks, [], NOW, { daily: false, reminders: true }));
    expect([...mockStore.keys()].sort()).toEqual(['gd:rem:a', TEST_ID]);
    await syncSchedule([]);
    expect([...mockStore.keys()]).toEqual([TEST_ID]);
  });

  it('keeps going when one schedule call fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    N.scheduleNotificationAsync.mockImplementationOnce(async () => { throw new Error('trigger in the past'); });
    const r = await syncSchedule([p('gd:a'), p('gd:b')]);
    expect(r).toEqual({ cancelled: 0, scheduled: 2, failed: 1 });
    expect([...mockStore.keys()]).toEqual(['gd:b']);
    warn.mockRestore();
  });

  it('accepts an injected scheduler api', async () => {
    const api: SchedulerApi = {
      getAllScheduledNotificationsAsync: jest.fn(async () => []),
      cancelScheduledNotificationAsync: jest.fn(async () => {}),
      scheduleNotificationAsync: jest.fn(async () => 'x'),
    };
    await syncSchedule([p('gd:a')], api);
    expect(api.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('planKey', () => {
  it('is equal for equal plans and differs when an id, time or content differs', () => {
    const plan = [p('gd:a'), p('gd:b')];
    expect(planKey(plan)).toBe(planKey([p('gd:a'), p('gd:b')]));
    expect(planKey(plan)).not.toBe(planKey([p('gd:a')]));
    expect(planKey(plan)).not.toBe(planKey([p('gd:a'), p('gd:c')]));
    expect(planKey(plan)).not.toBe(planKey([p('gd:a'), p('gd:b', 'y')]));
    expect(planKey(plan)).not.toBe(planKey([p('gd:a'), p('gd:b', 'x', new Date(2026, 9, 18, 10))]));
    expect(planKey([])).toBe('');
  });
});
