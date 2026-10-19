/**
 * Diff + apply: makes the OS schedule match a plan. Identifiers are stable (see plan.ts) and
 * every scheduled request carries a content signature in `data.sig`, so a task whose title or
 * time changed is replaced even though its identifier stays the same.
 */
import * as Notifications from 'expo-notifications';
import { ACCENT, CHANNEL_REMINDERS, REMINDER_SOUND, REMINDER_VIBRATION, TEST_ID, type PlannedNotification } from './plan';

/** The subset of expo-notifications the sync engine uses (injectable for tests). */
export interface SchedulerApi {
  getAllScheduledNotificationsAsync(): Promise<Notifications.NotificationRequest[]>;
  cancelScheduledNotificationAsync(identifier: string): Promise<void>;
  scheduleNotificationAsync(request: Notifications.NotificationRequestInput): Promise<string>;
}

/** Content signature: anything that changes what/when the user sees something. */
export function signature(p: PlannedNotification): string {
  return [p.at.getTime(), p.channel, p.title, p.body].join('|');
}

/**
 * Identity of a whole plan (ids + signatures, in order). Two plans with the same key produce the
 * same OS schedule, so a sync of an unchanged plan can skip the native round-trip.
 */
export function planKey(planned: readonly PlannedNotification[]): string {
  let key = '';
  for (const p of planned) key += p.id + '\u0001' + signature(p) + '\u0002';
  return key;
}

export interface ScheduledLike {
  identifier: string;
  content?: { data?: Record<string, unknown> | null } | null;
}

export interface ScheduleDiff {
  cancel: string[];
  schedule: PlannedNotification[];
}

/**
 * What to cancel and what to (re)schedule. Unknown/stale identifiers are cancelled (the test
 * reminder is left alone); a planned item whose signature differs is cancelled and rescheduled.
 */
export function diffSchedule(planned: readonly PlannedNotification[], scheduled: readonly ScheduledLike[]): ScheduleDiff {
  const want = new Map(planned.map((p) => [p.id, p] as const));
  const have = new Map<string, string | undefined>();
  const cancel: string[] = [];
  for (const s of scheduled) {
    if (s.identifier === TEST_ID) continue;
    const sig = s.content?.data?.sig;
    const p = want.get(s.identifier);
    if (!p || have.has(s.identifier) || sig !== signature(p)) cancel.push(s.identifier);
    else have.set(s.identifier, sig);
  }
  const schedule = planned.filter((p) => !have.has(p.id));
  return { cancel, schedule };
}

/** The request scheduled for a planned item. */
export function toRequest(p: PlannedNotification): Notifications.NotificationRequestInput {
  const reminder = p.channel === CHANNEL_REMINDERS;
  return {
    identifier: p.id,
    content: {
      title: p.title,
      body: p.body,
      data: { ...p.data, sig: signature(p) },
      color: ACCENT,
      // Android 8+ takes sound/vibration from the channel; these cover older versions.
      sound: reminder ? REMINDER_SOUND : false,
      ...(reminder ? { vibrate: REMINDER_VIBRATION } : {}),
      priority: reminder ? Notifications.AndroidNotificationPriority.HIGH : Notifications.AndroidNotificationPriority.LOW,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: p.at,
      channelId: p.channel,
    },
  };
}

export interface SyncResult {
  cancelled: number;
  scheduled: number;
  failed: number;
}

/** Applies the plan. Individual failures (e.g. a trigger that just passed) are logged and skipped. */
export async function syncSchedule(planned: readonly PlannedNotification[], api: SchedulerApi = Notifications): Promise<SyncResult> {
  const scheduled = await api.getAllScheduledNotificationsAsync();
  const { cancel, schedule } = diffSchedule(planned, scheduled || []);
  let failed = 0;
  for (const id of cancel) {
    try {
      await api.cancelScheduledNotificationAsync(id);
    } catch (e) {
      failed++;
      console.warn('[notifications] cancel failed', id, e);
    }
  }
  for (const p of schedule) {
    try {
      await api.scheduleNotificationAsync(toRequest(p));
    } catch (e) {
      failed++;
      console.warn('[notifications] schedule failed', p.id, e);
    }
  }
  return { cancelled: cancel.length, scheduled: schedule.length, failed };
}
