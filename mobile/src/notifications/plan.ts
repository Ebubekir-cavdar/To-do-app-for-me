/**
 * Pure notification planner: tasks + "now" + settings → the exact list of notifications
 * that should be scheduled. No I/O, no expo-notifications — the sync engine diffs this
 * list against what the OS has scheduled.
 */
import { addDays, DAYS, dayIndex, MONTHS, parseYmd, startOfDay, ymd } from '../lib/dates';
import { isOpen, normalizeTime, sortTasks } from '../lib/tasks';
import type { Task } from '../model/task';

/** Android channel ids. Channels are immutable once created on the device: change a setting → bump the version. */
export const CHANNEL_DAILY = 'daily-summary-v1';
export const CHANNEL_REMINDERS = 'reminders-v1';
export type ChannelId = typeof CHANNEL_DAILY | typeof CHANNEL_REMINDERS;

/** Raw resource name of the user's reminder sound (copied by the expo-notifications config plugin). */
export const REMINDER_SOUND = 'hatirlatma.mp3';
/** Delay, buzz, pause, buzz… — two short sword strikes and a long one. */
export const REMINDER_VIBRATION = [0, 250, 150, 250, 150, 500];
/** EU4 gold, used as the notification accent color. */
export const ACCENT = '#d4ad57';

export const DAILY_HOUR = 9;
export const DAILY_MINUTE = 0;
export const REMINDER_LEAD_MIN = 30;
export const HORIZON_DAYS = 14;
export const MAX_SUMMARY_LINES = 5;
/** AlarmManager allows ~500 alarms per app; stay well below it. */
export const MAX_PLANNED = 300;

/** Every identifier this app schedules starts with this prefix. */
export const ID_PREFIX = 'gd:';
export const TEST_ID = ID_PREFIX + 'test';

export interface PlanSettings {
  daily: boolean;
  reminders: boolean;
}

export type PlannedKind = 'daily' | 'reminder';

export interface PlannedData extends Record<string, unknown> {
  kind: PlannedKind | 'test';
  /** The day the notification is about (`YYYY-MM-DD`). */
  ymd: string;
  taskId?: string;
}

export interface PlannedNotification {
  /** Stable identifier: `gd:daily:<ymd>` or `gd:rem:<taskId>`. */
  id: string;
  at: Date;
  channel: ChannelId;
  title: string;
  body: string;
  data: PlannedData;
}

export const dailyId = (day: string) => `${ID_PREFIX}daily:${day}`;
export const reminderId = (taskId: string) => `${ID_PREFIX}rem:${taskId}`;

/** `📜 Divan'dan haber — Cumartesi, 17 Ekim` */
export function dailyTitle(day: Date): string {
  return `📜 Divan'dan haber — ${DAYS[dayIndex(day)]}, ${day.getDate()} ${MONTHS[day.getMonth()]}`;
}

/**
 * Body of the day's summary: up to 5 open tasks ("• 07:30 Sabah yürüyüşü", "• Market"),
 * "+N görev daha", and "⚠ N geciken görev" — or "Bugün için kayıtlı görev yok."
 */
export function dailyBody(dayTasks: readonly Task[], overdueCount: number): string {
  const open = sortTasks(dayTasks.filter(isOpen));
  const lines: string[] = [];
  if (open.length === 0) {
    lines.push('Bugün için kayıtlı görev yok.');
  } else {
    for (const t of open.slice(0, MAX_SUMMARY_LINES)) {
      const time = normalizeTime(t.time);
      lines.push('• ' + (time ? time + ' ' : '') + oneLine(t.title));
    }
    if (open.length > MAX_SUMMARY_LINES) lines.push(`+${open.length - MAX_SUMMARY_LINES} görev daha`);
  }
  if (overdueCount > 0) lines.push(`⚠ ${overdueCount} geciken görev`);
  return lines.join('\n');
}

export const REMINDER_TITLE = '⚔ Ulak geldi!';

/** `«Spor salonu» yarım saat sonra başlıyor (18:00).` */
export function reminderBody(title: string, time: string): string {
  return `«${oneLine(title)}» yarım saat sonra başlıyor (${time}).`;
}

function oneLine(s: string): string {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > 80 ? t.slice(0, 79) + '…' : t;
}

/** Local date-time of `HH:MM` on `YYYY-MM-DD`, shifted by `deltaMin` (handles midnight and DST). */
function localTime(day: string, hhmm: string, deltaMin = 0): Date {
  const d = parseYmd(day);
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m + deltaMin, 0, 0);
}

const NONE: Task[] = [];

/** Number of strings in sorted `arr` that are < `key` (same ordering as the `<` operator). */
function countBelow(arr: readonly string[], key: string): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < key) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Plans the notifications of the rolling window [start of today, start of today + horizonDays).
 *
 * @param tasks     Tasks in [today, today + horizonDays] (one extra day so a 00:10 task on the day
 *                  after the window still gets its 23:40 reminder inside it).
 * @param openTasks All not-done tasks of any date — for the "⚠ N geciken görev" line. Failed tasks
 *                  (here or in `tasks`) get no reminder and appear in neither the summary nor that line.
 * @param now       Current time; anything at or before it is skipped (today's 09:00 summary
 *                  once 09:00 has passed, reminders whose trigger time is gone).
 */
export function planNotifications(
  tasks: readonly Task[],
  openTasks: readonly Task[],
  now: Date,
  settings: PlanSettings,
  horizonDays: number = HORIZON_DAYS,
): PlannedNotification[] {
  const today = startOfDay(now);
  const windowEnd = addDays(today, horizonDays);
  const out: PlannedNotification[] = [];

  // Latest known state per task: the range snapshot wins over the open-tasks snapshot.
  const byId = new Map<string, Task>();
  for (const t of openTasks) byId.set(t.id, t);
  for (const t of tasks) byId.set(t.id, t);
  const allOpen = [...byId.values()].filter(isOpen);

  if (settings.daily) {
    // One pass instead of two filters per day: open tasks by date (in allOpen order) and all
    // their dates sorted, so "how many are before this day" is a binary search.
    const byDate = new Map<string, Task[]>();
    const dates: string[] = [];
    for (const t of allOpen) {
      const list = byDate.get(t.date);
      if (list) list.push(t);
      else byDate.set(t.date, [t]);
      dates.push(t.date);
    }
    dates.sort();
    for (let i = 0; i < horizonDays; i++) {
      const day = addDays(today, i);
      const key = ymd(day);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), DAILY_HOUR, DAILY_MINUTE, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      const dayTasks = byDate.get(key) ?? NONE;
      const overdue = countBelow(dates, key);
      out.push({
        id: dailyId(key),
        at,
        channel: CHANNEL_DAILY,
        title: dailyTitle(day),
        body: dailyBody(dayTasks, overdue),
        data: { kind: 'daily', ymd: key },
      });
    }
  }

  if (settings.reminders) {
    for (const t of allOpen) {
      const time = normalizeTime(t.time);
      if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      const at = localTime(t.date, time, -REMINDER_LEAD_MIN);
      if (at.getTime() <= now.getTime() || at.getTime() >= windowEnd.getTime()) continue;
      out.push({
        id: reminderId(t.id),
        at,
        channel: CHANNEL_REMINDERS,
        title: REMINDER_TITLE,
        body: reminderBody(t.title, time),
        data: { kind: 'reminder', ymd: t.date, taskId: t.id },
      });
    }
  }

  out.sort((a, b) => a.at.getTime() - b.at.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, MAX_PLANNED);
}
