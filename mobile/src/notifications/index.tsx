/**
 * Notifications contract (UI ↔ notifications engine) and its implementation.
 *
 * Features (user's spec):
 * - Daily summary at 09:00, silent: today's open tasks (max 5 lines, "+N görev daha"),
 *   an overdue line if any, or "Bugün için kayıtlı görev yok."
 * - Reminder 30 min before each open timed task, with the user's sound
 *   (assets/sounds/hatirlatma.mp3) and vibration.
 * - Both are planned locally for a rolling 14-day window (plan.ts, pure) and synced to the OS
 *   schedule (sync.ts, diff by id + content) when tasks or settings change, when the app comes
 *   to the foreground, and when the day changes.
 * - Data: only the open-tasks subscription (shared with the week screen — one Firestore
 *   listener). Every planned item is an open task or a summary of open tasks, so a separate
 *   [today, today + 14] range listener would add reads and snapshots without changing the plan.
 * - A plan identical (ids + signatures) to the one last applied skips the native round-trip
 *   (getAllScheduledNotificationsAsync + diff); returning to the foreground always does the full
 *   sync, in case the OS schedule changed meanwhile. Nothing runs on a timer while idle.
 *
 * Web (and anything without the native module) gets permission 'unsupported' and no-ops.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useData, useOpenTasksState } from '../data/DataProvider';
import { useToday } from '../hooks/useToday';
import type { Task } from '../model/task';
import { askPermission, cancelAll, ensureChannels, installForegroundHandler, listenForTaps, nativeSupported, readPermission, scheduleTestReminder } from './native';
import { planNotifications } from './plan';
import { planKey, syncSchedule } from './sync';

export type NotificationPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface NotificationSettings {
  /** 09:00 daily summary. */
  daily: boolean;
  /** 30-minutes-before reminders for timed tasks. */
  reminders: boolean;
}

export interface NotificationsApi {
  permission: NotificationPermission;
  settings: NotificationSettings;
  setSettings(patch: Partial<NotificationSettings>): void;
  /** Shows the OS permission dialog (Android 13+). Resolves true if granted. */
  requestPermission(): Promise<boolean>;
  /** True once per install while permission is 'undetermined' and the in-app explainer hasn't been answered. */
  shouldAskPermission: boolean;
  /** Call when the user answered the in-app explainer (either way), so it isn't shown again. */
  markAsked(): void;
  /** Fires a sample reminder in ~3 s (sound + vibration) so the user can check it. */
  sendTestReminder(): Promise<void>;
}

export const SETTINGS_KEY = 'settings.notifications';
export const ASKED_KEY = 'notifications.asked';
export const DEFAULT_SETTINGS: NotificationSettings = { daily: true, reminders: true };
/** Quiet period after the last change before the schedule is synced. */
export const SYNC_DEBOUNCE_MS = 1500;

const STUB: NotificationsApi = {
  permission: 'unsupported',
  settings: DEFAULT_SETTINGS,
  setSettings() {},
  async requestPermission() { return false; },
  shouldAskPermission: false,
  markAsked() {},
  async sendTestReminder() {},
};

const Ctx = createContext<NotificationsApi>(STUB);
const openListeners = new Set<() => void>();
/** A tap that arrived before any screen subscribed (cold start) — delivered to the first subscriber. */
let pendingOpenAt = 0;
const PENDING_OPEN_MS = 15000;

/** Mount inside the signed-in tree (needs DataProvider). Plans notifications from the user's tasks. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  if (!nativeSupported) return <Ctx.Provider value={STUB}>{children}</Ctx.Provider>;
  return <NativeNotificationsProvider>{children}</NativeNotificationsProvider>;
}

/** Every OS-schedule change goes through this queue, so syncs and cancel-all never interleave. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => {});
  return run;
}

/** planKey() of the plan the OS schedule was last made to match (null = unknown, sync fully). */
let appliedKey: string | null = null;
async function cancelAllScheduled(): Promise<void> {
  appliedKey = null;
  await cancelAll();
}
const NO_TASKS: Task[] = [];

function parseSettings(raw: string | null): NotificationSettings {
  try {
    const v = raw ? JSON.parse(raw) : null;
    return {
      daily: typeof v?.daily === 'boolean' ? v.daily : DEFAULT_SETTINGS.daily,
      reminders: typeof v?.reminders === 'boolean' ? v.reminders : DEFAULT_SETTINGS.reminders,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function NativeNotificationsProvider({ children }: { children: ReactNode }) {
  const { repo } = useData();
  const today = useToday();
  const { tasks: openTasks, loading } = useOpenTasksState();

  const [settings, setSettingsState] = useState<NotificationSettings | null>(null);
  const [asked, setAsked] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [foregroundTick, setForegroundTick] = useState(0);

  // Startup: foreground handler, taps, stored settings, permission (read in parallel). Channels
  // are created by the first sync (before anything is scheduled) or the permission prompt, not
  // here, to keep native calls off the first-render path.
  useEffect(() => {
    let alive = true;
    installForegroundHandler();
    const stopTaps = listenForTaps(emitNotificationOpen);
    AsyncStorage.multiGet([SETTINGS_KEY, ASKED_KEY])
      .then((pairs) => {
        if (!alive) return;
        const map = new Map(pairs);
        setSettingsState(parseSettings(map.get(SETTINGS_KEY) ?? null));
        setAsked(map.get(ASKED_KEY) === '1');
      })
      .catch(() => {
        if (!alive) return;
        setSettingsState(DEFAULT_SETTINGS);
        setAsked(false);
      });
    readPermission().then((p) => { if (alive) setPermission(p); });
    return () => {
      alive = false;
      stopTaps();
    };
  }, []);

  // Back in the foreground: the user may have changed the permission in system settings, and
  // "now" has moved on — re-check and re-plan.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      readPermission().then(setPermission);
      setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  // Unmount = signed out (or the user changed): nothing of theirs may fire any more.
  useEffect(() => () => { enqueue(cancelAllScheduled); }, []);

  // The sync: debounced, planned from the latest snapshot, applied as a diff.
  const ready = settings !== null && permission !== null && (!repo || !loading);
  const syncedTick = useRef(-1);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => {
      enqueue(async () => {
        if (!repo || permission !== 'granted' || !settings) {
          // Signed out, or nothing may be shown: keep the OS schedule empty.
          await cancelAllScheduled();
          return;
        }
        const planned = planNotifications(NO_TASKS, openTasks, new Date(), settings);
        const key = planKey(planned);
        // Back from the background: the OS schedule may have changed behind our back — full sync.
        const fresh = syncedTick.current !== foregroundTick;
        syncedTick.current = foregroundTick;
        if (!fresh && key === appliedKey) return;
        appliedKey = null;
        await ensureChannels();
        const r = await syncSchedule(planned);
        if (r.failed === 0) appliedKey = key;
      }).catch((e) => console.warn('[notifications] sync failed', e));
    }, SYNC_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, repo, openTasks, settings, permission, today, foregroundTick]);

  const setSettings = useCallback((patch: Partial<NotificationSettings>) => {
    setSettingsState((prev) => {
      const next = { ...(prev ?? DEFAULT_SETTINGS), ...patch };
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const requestPermission = useCallback(async () => {
    const p = await askPermission();
    setPermission(p);
    return p === 'granted';
  }, []);

  const markAsked = useCallback(() => {
    setAsked(true);
    AsyncStorage.setItem(ASKED_KEY, '1').catch(() => {});
  }, []);

  const value = useMemo<NotificationsApi>(
    () => ({
      permission: permission ?? 'undetermined',
      settings: settings ?? DEFAULT_SETTINGS,
      setSettings,
      requestPermission,
      shouldAskPermission: permission === 'undetermined' && asked === false,
      markAsked,
      sendTestReminder: scheduleTestReminder,
    }),
    [permission, settings, asked, setSettings, requestPermission, markAsked],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications(): NotificationsApi {
  return useContext(Ctx);
}

/** Called when the user taps a notification (app opened or resumed from it). The week screen jumps to today. */
export function useNotificationOpen(cb: () => void): void {
  const ref = useRef(cb);
  useEffect(() => { ref.current = cb; });
  useEffect(() => {
    const l = () => ref.current();
    openListeners.add(l);
    if (pendingOpenAt) {
      const fresh = Date.now() - pendingOpenAt < PENDING_OPEN_MS;
      pendingOpenAt = 0;
      if (fresh) l();
    }
    return () => { openListeners.delete(l); };
  }, []);
}

/** For the engine: notify useNotificationOpen subscribers. */
export function emitNotificationOpen(): void {
  if (openListeners.size === 0) {
    pendingOpenAt = Date.now();
    return;
  }
  pendingOpenAt = 0;
  openListeners.forEach((l) => l());
}
