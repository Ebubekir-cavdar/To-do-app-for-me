/// <reference types="jest" />
import type { Task } from '../../model/task';
import {
  CHANNEL_DAILY,
  CHANNEL_REMINDERS,
  dailyBody,
  dailyTitle,
  planNotifications,
  type PlannedNotification,
} from '../plan';

let seq = 0;
function task(p: Partial<Task> & { date: string }): Task {
  seq++;
  return { id: 't' + seq, title: 'Görev ' + seq, time: null, done: false, failed: false, createdAt: seq, categoryId: null, recurrenceId: null, ...p };
}

const ON = { daily: true, reminders: true };
// Saturday 17 October 2026.
const at = (h: number, m = 0, d = 17, mo = 9) => new Date(2026, mo, d, h, m, 0, 0);
const dailies = (p: PlannedNotification[]) => p.filter((x) => x.channel === CHANNEL_DAILY);
const reminders = (p: PlannedNotification[]) => p.filter((x) => x.channel === CHANNEL_REMINDERS);
const byId = (p: PlannedNotification[], id: string) => p.find((x) => x.id === id);

beforeEach(() => { seq = 0; });

describe('daily summary', () => {
  it('plans one silent 09:00 summary per day of the 14-day window, today included before 09:00', () => {
    const plan = dailies(planNotifications([], [], at(8, 59), ON));
    expect(plan).toHaveLength(14);
    expect(plan[0]).toMatchObject({ id: 'gd:daily:2026-10-17', channel: CHANNEL_DAILY, data: { kind: 'daily', ymd: '2026-10-17' } });
    expect(plan[0].at).toEqual(at(9));
    expect(plan[13].id).toBe('gd:daily:2026-10-30');
    expect(plan[13].at).toEqual(at(9, 0, 30));
    plan.forEach((p) => expect(p.at.getHours()).toBe(9));
  });

  it('skips today once 09:00 has come (boundary is inclusive)', () => {
    expect(byId(planNotifications([], [], at(9, 0), ON), 'gd:daily:2026-10-17')).toBeUndefined();
    expect(byId(planNotifications([], [], at(9, 0), ON), 'gd:daily:2026-10-18')).toBeDefined();
    expect(dailies(planNotifications([], [], at(9, 0), ON))).toHaveLength(13);
    expect(dailies(planNotifications([], [], at(23, 59), ON))).toHaveLength(13);
    // One millisecond before 09:00 still plans it.
    expect(byId(planNotifications([], [], new Date(at(9).getTime() - 1), ON), 'gd:daily:2026-10-17')).toBeDefined();
  });

  it('has the Divan title with the Turkish day and month', () => {
    expect(dailyTitle(at(0))).toBe("📜 Divan'dan haber — Cumartesi, 17 Ekim");
    const plan = planNotifications([], [], at(8), ON);
    expect(byId(plan, 'gd:daily:2026-10-19')!.title).toBe("📜 Divan'dan haber — Pazartesi, 19 Ekim");
  });

  it('says there is nothing on an empty day', () => {
    const plan = planNotifications([], [], at(8), ON);
    expect(byId(plan, 'gd:daily:2026-10-17')!.body).toBe('Bugün için kayıtlı görev yok.');
  });

  it('lists open tasks sorted (timed by time, then untimed by creation), with and without time', () => {
    const tasks = [
      task({ date: '2026-10-17', title: 'Market alışverişi' }),
      task({ date: '2026-10-17', title: 'Spor salonu', time: '18:00' }),
      task({ date: '2026-10-17', title: 'Sabah yürüyüşü', time: '07:30' }),
    ];
    const body = byId(planNotifications(tasks, [], at(6), ON), 'gd:daily:2026-10-17')!.body;
    expect(body).toBe(['• 07:30 Sabah yürüyüşü', '• 18:00 Spor salonu', '• Market alışverişi'].join('\n'));
  });

  it('shows at most 5 lines, then "+N görev daha"', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task({ date: '2026-10-18', title: 'İş ' + (i + 1), time: i < 3 ? `1${i}:00` : null }));
    const lines = byId(planNotifications(tasks, [], at(8), ON), 'gd:daily:2026-10-18')!.body.split('\n');
    expect(lines).toEqual(['• 10:00 İş 1', '• 11:00 İş 2', '• 12:00 İş 3', '• İş 4', '• İş 5', '+3 görev daha']);
  });

  it('exactly 5 tasks → no "+N" line', () => {
    const tasks = Array.from({ length: 5 }, () => task({ date: '2026-10-18' }));
    const body = byId(planNotifications(tasks, [], at(8), ON), 'gd:daily:2026-10-18')!.body;
    expect(body.split('\n')).toHaveLength(5);
    expect(body).not.toContain('görev daha');
  });

  it('excludes done tasks', () => {
    const tasks = [task({ date: '2026-10-17', title: 'Bitti', done: true }), task({ date: '2026-10-17', title: 'Açık' })];
    const body = byId(planNotifications(tasks, [], at(8), ON), 'gd:daily:2026-10-17')!.body;
    expect(body).toBe('• Açık');
    const onlyDone = [task({ date: '2026-10-18', title: 'Bitti', done: true })];
    expect(byId(planNotifications(onlyDone, [], at(8), ON), 'gd:daily:2026-10-18')!.body).toBe('Bugün için kayıtlı görev yok.');
  });

  it('adds "⚠ N geciken görev" for open tasks dated before that day', () => {
    const open = [task({ date: '2026-10-10' }), task({ date: '2026-10-16' })];
    const plan = planNotifications([task({ date: '2026-10-17', title: 'Bugün' })], open, at(8), ON);
    expect(byId(plan, 'gd:daily:2026-10-17')!.body).toBe('• Bugün\n⚠ 2 geciken görev');
    // Tomorrow's summary also counts today's still-open task (as known now).
    expect(byId(plan, 'gd:daily:2026-10-18')!.body).toBe('Bugün için kayıtlı görev yok.\n⚠ 3 geciken görev');
  });

  it('does not count done tasks as overdue, nor future open tasks', () => {
    const open = [task({ date: '2026-10-25' })];
    const range = [task({ date: '2026-10-17', done: true })];
    const plan = planNotifications(range, open, at(8), ON);
    expect(byId(plan, 'gd:daily:2026-10-17')!.body).toBe('Bugün için kayıtlı görev yok.');
  });

  it('prefers the range snapshot when a task was just marked done but is still in the open list', () => {
    const t = task({ date: '2026-10-16' });
    const plan = planNotifications([{ ...t, done: true }], [t], at(8), ON);
    expect(byId(plan, 'gd:daily:2026-10-17')!.body).toBe('Bugün için kayıtlı görev yok.');
  });

  it('dailyBody: no tasks but overdue', () => {
    expect(dailyBody([], 1)).toBe('Bugün için kayıtlı görev yok.\n⚠ 1 geciken görev');
  });

  it('collapses whitespace in titles and shortens very long ones', () => {
    const body = dailyBody([task({ date: '2026-10-17', title: '  Çok\n  satırlı   başlık ' })], 0);
    expect(body).toBe('• Çok satırlı başlık');
    const long = dailyBody([task({ date: '2026-10-17', title: 'x'.repeat(200) })], 0);
    expect(long.length).toBeLessThanOrEqual(2 + 80);
    expect(long.endsWith('…')).toBe(true);
  });
});

describe('reminders', () => {
  it('fires 30 minutes before each open timed task with the Ulak wording', () => {
    const t = task({ id: 'abc', date: '2026-10-17', title: 'Spor salonu', time: '18:00' });
    const plan = reminders(planNotifications([t], [], at(10), ON));
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      id: 'gd:rem:abc',
      channel: CHANNEL_REMINDERS,
      title: '⚔ Ulak geldi!',
      body: '«Spor salonu» yarım saat sonra başlıyor (18:00).',
      data: { kind: 'reminder', ymd: '2026-10-17', taskId: 'abc' },
    });
    expect(plan[0].at).toEqual(at(17, 30));
  });

  it('ignores untimed, done, and badly-timed tasks', () => {
    const tasks = [
      task({ date: '2026-10-18' }),
      task({ date: '2026-10-18', time: '12:00', done: true }),
      task({ date: '2026-10-18', time: '25:00' }),
    ];
    expect(reminders(planNotifications(tasks, [], at(10), ON))).toEqual([]);
  });

  it('skips reminders whose trigger time has passed (even if the task is still ahead)', () => {
    const tasks = [
      task({ id: 'soon', date: '2026-10-17', time: '10:20' }), // trigger 09:50 < now
      task({ id: 'edge', date: '2026-10-17', time: '10:30' }), // trigger 10:00 == now → skipped
      task({ id: 'ok', date: '2026-10-17', time: '10:31' }), // trigger 10:01
    ];
    const ids = reminders(planNotifications(tasks, [], at(10), ON)).map((p) => p.id);
    expect(ids).toEqual(['gd:rem:ok']);
  });

  it('crosses midnight: a 00:10 task reminds at 23:40 the previous day', () => {
    const t = task({ id: 'night', date: '2026-10-18', time: '00:10' });
    const plan = reminders(planNotifications([t], [], at(20), ON));
    expect(plan[0].at).toEqual(at(23, 40, 17));
    expect(plan[0].data.ymd).toBe('2026-10-18');
    // Already past 23:40 → skipped.
    expect(reminders(planNotifications([t], [], at(23, 45), ON))).toEqual([]);
  });

  it('crosses month and year boundaries', () => {
    const t = task({ date: '2027-01-01', time: '00:00' });
    const plan = reminders(planNotifications([t], [], new Date(2026, 11, 31, 12), ON));
    expect(plan[0].at).toEqual(new Date(2026, 11, 31, 23, 30));
  });

  it('respects the horizon (today .. today+13; a 00:10 task on day 14 still counts)', () => {
    const tasks = [
      task({ id: 'd13', date: '2026-10-30', time: '12:00' }),
      task({ id: 'd14', date: '2026-10-31', time: '12:00' }),
      task({ id: 'd14early', date: '2026-10-31', time: '00:10' }),
      task({ id: 'past', date: '2026-10-16', time: '12:00' }),
    ];
    const ids = reminders(planNotifications(tasks, [], at(8), ON)).map((p) => p.id).sort();
    expect(ids).toEqual(['gd:rem:d13', 'gd:rem:d14early']);
  });

  it('honours a custom horizon', () => {
    const tasks = [task({ id: 'a', date: '2026-10-19', time: '12:00' }), task({ id: 'b', date: '2026-10-20', time: '12:00' })];
    const plan = planNotifications(tasks, [], at(8), ON, 3);
    expect(dailies(plan).map((p) => p.data.ymd)).toEqual(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(reminders(plan).map((p) => p.id)).toEqual(['gd:rem:a']);
  });

  it('also plans reminders from the open-tasks list (deduplicated by id)', () => {
    const t = task({ id: 'x', date: '2026-10-18', time: '12:00' });
    expect(reminders(planNotifications([t], [t], at(8), ON))).toHaveLength(1);
  });
});

describe('settings and output shape', () => {
  const tasks = () => [task({ date: '2026-10-18', time: '12:00' })];

  it('daily off → reminders only', () => {
    const plan = planNotifications(tasks(), [], at(8), { daily: false, reminders: true });
    expect(dailies(plan)).toEqual([]);
    expect(reminders(plan)).toHaveLength(1);
  });

  it('reminders off → summaries only', () => {
    const plan = planNotifications(tasks(), [], at(8), { daily: true, reminders: false });
    expect(reminders(plan)).toEqual([]);
    expect(dailies(plan)).toHaveLength(14);
  });

  it('both off → nothing', () => {
    expect(planNotifications(tasks(), [], at(8), { daily: false, reminders: false })).toEqual([]);
  });

  it('is sorted by time, deterministic, and ids are unique', () => {
    const list = [task({ date: '2026-10-17', time: '09:30' }), task({ date: '2026-10-17', time: '09:20' })];
    const a = planNotifications(list, [], at(8), ON);
    const b = planNotifications(list.slice().reverse(), [], at(8), ON);
    expect(a).toEqual(b);
    const times = a.map((p) => p.at.getTime());
    expect(times).toEqual(times.slice().sort((x, y) => x - y));
    expect(new Set(a.map((p) => p.id)).size).toBe(a.length);
    // 08:50 reminder, 09:00 summary (both at 09:00 ties sorted by id), 09:00 reminder.
    expect(a.slice(0, 3).map((p) => p.id)).toEqual(['gd:rem:t2', 'gd:daily:2026-10-17', 'gd:rem:t1']);
  });

  it('caps the plan below the AlarmManager limit, keeping the earliest', () => {
    const many = Array.from({ length: 600 }, (_, i) => task({ date: '2026-10-18', time: '12:' + String(i % 60).padStart(2, '0') }));
    const plan = planNotifications(many, [], at(8), ON);
    expect(plan.length).toBe(300);
    expect(plan[0].id).toBe('gd:daily:2026-10-17');
  });
});

describe('planNotifications equals the straightforward per-day filtering', () => {
  // The planner groups by date once and binary-searches the overdue count; this is the original
  // two-filters-per-day formulation, which must give exactly the same plan.
  function reference(tasks: Task[], openTasks: Task[], now: Date, settings: typeof ON): PlannedNotification[] {
    const out = planNotifications(tasks, openTasks, now, { daily: false, reminders: settings.reminders });
    if (settings.daily) {
      const byIdMap = new Map<string, Task>();
      for (const t of openTasks) byIdMap.set(t.id, t);
      for (const t of tasks) byIdMap.set(t.id, t);
      const allOpen = [...byIdMap.values()].filter((t) => !t.done);
      for (let i = 0; i < 14; i++) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
        const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0, 0);
        if (when.getTime() <= now.getTime()) continue;
        out.push({
          id: 'gd:daily:' + key,
          at: when,
          channel: CHANNEL_DAILY,
          title: dailyTitle(day),
          body: dailyBody(allOpen.filter((t) => t.date === key), allOpen.filter((t) => t.date < key).length),
          data: { kind: 'daily', ymd: key },
        });
      }
    }
    out.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out.slice(0, 300);
  }

  it('on random task sets (dates before, inside and after the window; done mixes; duplicates across lists)', () => {
    let s = 12345;
    const rnd = (n: number) => { s = (s * 1103515245 + 12345) % 2147483648; return s % n; };
    for (let round = 0; round < 40; round++) {
      const now = at(rnd(24), rnd(60), 1 + rnd(28), rnd(12));
      const mk = () => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + rnd(40) - 15);
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return task({ date, time: rnd(3) ? `${String(rnd(24)).padStart(2, '0')}:${String(rnd(60)).padStart(2, '0')}` : null, done: rnd(4) === 0 });
      };
      const open = Array.from({ length: rnd(60) }, mk).map((t) => ({ ...t, done: false }));
      const tasks = [...Array.from({ length: rnd(30) }, mk), ...open.slice(0, rnd(10)).map((t) => ({ ...t, done: rnd(2) === 0 }))];
      for (const settings of [ON, { daily: true, reminders: false }]) {
        expect(planNotifications(tasks, open, now, settings)).toEqual(reference(tasks, open, now, settings));
      }
    }
  });
});

describe('failed tasks', () => {
  it('get no reminder and appear neither in the summary nor in the overdue line', () => {
    const failedToday = task({ date: '2026-10-17', time: '18:00', title: 'Batu ile buluş', failed: true });
    const openToday = task({ date: '2026-10-17', time: '19:00', title: 'Spor' });
    const failedPast = task({ date: '2026-10-15', title: 'Eski buluşma', failed: true });
    const latePast = task({ date: '2026-10-16', title: 'Fatura' });
    const plan = planNotifications([failedToday, openToday], [failedToday, openToday, failedPast, latePast], at(8), ON);

    expect(byId(plan, 'gd:daily:2026-10-17')!.body).toBe('• 19:00 Spor\n⚠ 1 geciken görev');
    expect(reminders(plan).map((r) => r.data.taskId)).toEqual([openToday.id]);
    expect(dailyBody([failedToday], 0)).toBe('Bugün için kayıtlı görev yok.');
  });

  it('the range snapshot wins: a task failed there is dropped even if the open list still has it unfailed', () => {
    const t = task({ date: '2026-10-18', time: '10:00' });
    const plan = planNotifications([{ ...t, failed: true }], [t], at(8), ON);
    expect(reminders(plan)).toEqual([]);
    expect(byId(plan, 'gd:daily:2026-10-18')!.body).toBe('Bugün için kayıtlı görev yok.');
  });
});
