/**
 * Thin, guarded wrapper around expo-notifications. Every function is a no-op on web
 * (permission 'unsupported'); errors from the native side are logged, never thrown at the UI.
 */
import * as Notifications from 'expo-notifications';
import { AndroidAudioContentType, AndroidAudioUsage, AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import {
  ACCENT,
  CHANNEL_DAILY,
  CHANNEL_REMINDERS,
  REMINDER_SOUND,
  REMINDER_TITLE,
  REMINDER_VIBRATION,
  REMINDER_LEAD_MIN,
  TEST_ID,
  reminderBody,
} from './plan';
import type { NotificationPermission } from './index';

export const nativeSupported = Platform.OS !== 'web';

const warn = (what: string, e: unknown) => console.warn('[notifications] ' + what, e);

let channelsReady: Promise<void> | null = null;

/**
 * Creates the two Android channels (idempotent; memoized). Must run before scheduling and before
 * the Android 13+ permission prompt. Channel settings are frozen once created on the device —
 * to change them, bump the version in the channel id (plan.ts).
 */
export function ensureChannels(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  if (!channelsReady) {
    channelsReady = (async () => {
      await Notifications.setNotificationChannelAsync(CHANNEL_DAILY, {
        name: 'Sabah özeti',
        description: "Her sabah 09:00'da günün görevleri. Sessiz, titreşimsiz.",
        importance: AndroidImportance.LOW,
        sound: null,
        enableVibrate: false,
        enableLights: false,
        showBadge: false,
      });
      await Notifications.setNotificationChannelAsync(CHANNEL_REMINDERS, {
        name: 'Görev hatırlatmaları',
        description: 'Saatli görevlerden yarım saat önce, sesli ve titreşimli ulak.',
        importance: AndroidImportance.HIGH,
        sound: REMINDER_SOUND,
        audioAttributes: {
          usage: AndroidAudioUsage.NOTIFICATION,
          contentType: AndroidAudioContentType.SONIFICATION,
        },
        enableVibrate: true,
        vibrationPattern: REMINDER_VIBRATION,
        enableLights: true,
        lightColor: ACCENT,
        showBadge: true,
      });
    })().catch((e) => {
      channelsReady = null; // retry next time
      warn('channel setup failed', e);
    });
  }
  return channelsReady;
}

let handlerInstalled = false;

/** Show notifications while the app is open too (the summary stays quiet: list only, no banner). */
export function installForegroundHandler(): void {
  if (!nativeSupported || handlerInstalled) return;
  handlerInstalled = true;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async (n) => {
        const quiet = n?.request?.content?.data?.kind === 'daily';
        return {
          shouldShowBanner: !quiet,
          shouldShowList: true,
          shouldPlaySound: !quiet,
          shouldSetBadge: false,
          priority: quiet ? Notifications.AndroidNotificationPriority.LOW : Notifications.AndroidNotificationPriority.HIGH,
        };
      },
    });
  } catch (e) {
    handlerInstalled = false;
    warn('handler setup failed', e);
  }
}

function mapPermission(res: { status?: string; granted?: boolean } | null | undefined): NotificationPermission {
  if (!res) return 'undetermined';
  if (res.granted || res.status === 'granted') return 'granted';
  if (res.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function readPermission(): Promise<NotificationPermission> {
  if (!nativeSupported) return 'unsupported';
  try {
    return mapPermission(await Notifications.getPermissionsAsync());
  } catch (e) {
    warn('permission check failed', e);
    return 'undetermined';
  }
}

/** Android 13+: shows the POST_NOTIFICATIONS dialog (needs a channel to exist first). */
export async function askPermission(): Promise<NotificationPermission> {
  if (!nativeSupported) return 'unsupported';
  try {
    await ensureChannels();
    return mapPermission(await Notifications.requestPermissionsAsync());
  } catch (e) {
    warn('permission request failed', e);
    return readPermission();
  }
}

/** Cancels every scheduled notification of this app (sign-out). */
export async function cancelAll(): Promise<void> {
  if (!nativeSupported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (e) {
    warn('cancel all failed', e);
  }
}

const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** A sample reminder on the reminders channel in ~3 s. */
export async function scheduleTestReminder(): Promise<void> {
  if (!nativeSupported) return;
  try {
    await ensureChannels();
    await Notifications.cancelScheduledNotificationAsync(TEST_ID).catch(() => {});
    const start = new Date(Date.now() + REMINDER_LEAD_MIN * 60000);
    await Notifications.scheduleNotificationAsync({
      identifier: TEST_ID,
      content: {
        title: REMINDER_TITLE,
        body: reminderBody('Deneme seferi', pad(start.getHours()) + ':' + pad(start.getMinutes())),
        data: { kind: 'test', ymd: '' },
        color: ACCENT,
        sound: REMINDER_SOUND,
        vibrate: REMINDER_VIBRATION,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, channelId: CHANNEL_REMINDERS },
    });
  } catch (e) {
    warn('test reminder failed', e);
  }
}

/** A key per tap, so the launch response and the listener don't both fire for the same tap. */
const handledTaps = new Set<string>();

function handleResponse(r: Notifications.NotificationResponse | null | undefined, onOpen: () => void): void {
  if (!r || r.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
  const key = (r.notification?.request?.identifier ?? '') + '@' + (r.notification?.date ?? '');
  if (handledTaps.has(key)) return;
  handledTaps.add(key);
  onOpen();
}

/**
 * Taps on notifications → onOpen(). Covers both a tap while the app is running (listener) and the
 * app having been launched by a tap (last response, read once and cleared). Returns unsubscribe.
 */
export function listenForTaps(onOpen: () => void): () => void {
  if (!nativeSupported) return () => {};
  let sub: { remove(): void } | null = null;
  try {
    sub = Notifications.addNotificationResponseReceivedListener((r) => handleResponse(r, onOpen));
  } catch (e) {
    warn('tap listener failed', e);
  }
  try {
    const last = Notifications.getLastNotificationResponse();
    if (last) {
      handleResponse(last, onOpen);
      Notifications.clearLastNotificationResponse();
    }
  } catch (e) {
    warn('last response failed', e);
  }
  return () => sub?.remove();
}
