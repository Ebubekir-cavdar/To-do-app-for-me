/// <reference types="jest" />
/**
 * Test double for expo-notifications: an in-memory OS schedule plus jest.fn()s for everything the
 * engine calls. Use as `jest.mock('expo-notifications', () => require('../testing/mockExpoNotifications').createMock())`
 * and reach it with `jest.requireMock('expo-notifications') as ExpoNotificationsMock`.
 */
import type { NotificationRequestInput, NotificationResponse } from 'expo-notifications';

export interface ExpoNotificationsMock {
  store: Map<string, NotificationRequestInput>;
  channels: Map<string, Record<string, unknown>>;
  permission: { status: 'granted' | 'denied' | 'undetermined'; granted: boolean };
  /** What a tap on the permission dialog yields. */
  requestResult: 'granted' | 'denied';
  lastResponse: NotificationResponse | null;
  responseListeners: Set<(r: NotificationResponse) => void>;
  handler: unknown;
  reset(): void;
  getAllScheduledNotificationsAsync: jest.Mock;
  cancelScheduledNotificationAsync: jest.Mock;
  cancelAllScheduledNotificationsAsync: jest.Mock;
  scheduleNotificationAsync: jest.Mock;
  setNotificationChannelAsync: jest.Mock;
  setNotificationHandler: jest.Mock;
  getPermissionsAsync: jest.Mock;
  requestPermissionsAsync: jest.Mock;
  addNotificationResponseReceivedListener: jest.Mock;
  getLastNotificationResponse: jest.Mock;
  clearLastNotificationResponse: jest.Mock;
  [k: string]: unknown;
}

export function createMock(): ExpoNotificationsMock {
  const m = {
    store: new Map<string, NotificationRequestInput>(),
    channels: new Map<string, Record<string, unknown>>(),
    permission: { status: 'granted', granted: true },
    requestResult: 'granted',
    lastResponse: null,
    responseListeners: new Set(),
    handler: null,

    // Enums/constants the engine uses (string values match the real package).
    DEFAULT_ACTION_IDENTIFIER: 'expo.modules.notifications.actions.DEFAULT',
    AndroidNotificationPriority: { MIN: 'min', LOW: 'low', DEFAULT: 'default', HIGH: 'high', MAX: 'max' },
    SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval', DAILY: 'daily' },
    AndroidImportance: { UNKNOWN: 0, UNSPECIFIED: 1, NONE: 2, MIN: 3, LOW: 4, DEFAULT: 5, HIGH: 6, MAX: 7 },
    AndroidAudioUsage: { NOTIFICATION: 5, NOTIFICATION_EVENT: 10, ALARM: 4 },
    AndroidAudioContentType: { UNKNOWN: 0, SONIFICATION: 4 },

    getAllScheduledNotificationsAsync: jest.fn(async () =>
      [...m.store.values()].map((r) => ({ identifier: r.identifier, content: r.content, trigger: r.trigger })),
    ),
    cancelScheduledNotificationAsync: jest.fn(async (id: string) => { m.store.delete(id); }),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => { m.store.clear(); }),
    scheduleNotificationAsync: jest.fn(async (r: NotificationRequestInput) => {
      m.store.set(r.identifier!, r);
      return r.identifier!;
    }),
    setNotificationChannelAsync: jest.fn(async (id: string, ch: Record<string, unknown>) => {
      m.channels.set(id, ch);
      return { id, ...ch };
    }),
    setNotificationHandler: jest.fn((h: unknown) => { m.handler = h; }),
    getPermissionsAsync: jest.fn(async () => ({ ...m.permission, canAskAgain: true, expires: 'never' })),
    requestPermissionsAsync: jest.fn(async () => {
      m.permission = { status: m.requestResult, granted: m.requestResult === 'granted' };
      return { ...m.permission, canAskAgain: true, expires: 'never' };
    }),
    addNotificationResponseReceivedListener: jest.fn((l: (r: NotificationResponse) => void) => {
      m.responseListeners.add(l);
      return { remove: () => m.responseListeners.delete(l) };
    }),
    getLastNotificationResponse: jest.fn(() => m.lastResponse),
    clearLastNotificationResponse: jest.fn(() => { m.lastResponse = null; }),

    reset() {
      m.store.clear();
      m.channels.clear();
      m.permission = { status: 'granted', granted: true };
      m.requestResult = 'granted';
      m.lastResponse = null;
      m.responseListeners.clear();
      m.handler = null;
    },
  } as unknown as ExpoNotificationsMock;
  return m;
}

/** A tap on a delivered notification. */
export function tapResponse(identifier: string, date = Date.now()): NotificationResponse {
  return {
    actionIdentifier: 'expo.modules.notifications.actions.DEFAULT',
    notification: { date, request: { identifier, content: { data: {} }, trigger: null } },
  } as unknown as NotificationResponse;
}
