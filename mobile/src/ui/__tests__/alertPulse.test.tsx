/// <reference types="jest" />
/**
 * The overdue alert's glow is the app's only endless animation: it must run only while it
 * can be seen (foreground, on screen) and never with reduced motion.
 */
import { act, render } from '@testing-library/react-native';
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native';
import type { Task } from '../../model/task';
import { DayPanel } from '../DayPanel';

const mockAnim = { repeats: 0, cancels: 0 };
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-audio', () => ({ useAudioPlayer: () => ({}), setAudioModeAsync: () => Promise.resolve() }));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const sv = (init: unknown) => {
    const t = { value: init };
    return { get value() { return t.value; }, set value(v) { t.value = v; }, get: () => t.value, set: (v: unknown) => { t.value = v; } };
  };
  const easing: any = new Proxy({}, { get: () => () => (x: unknown) => x });
  return {
    __esModule: true,
    default: { View },
    Easing: easing,
    useSharedValue: (init: unknown) => require('react').useState(() => sv(init))[0],
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    withRepeat: (v: unknown) => { mockAnim.repeats++; return v; },
    cancelAnimation: () => { mockAnim.cancels++; },
  };
});

let appState: ((s: AppStateStatus) => void) | null = null;
// useReducedMotion subscribes once per app: capture its OS listener before the first render.
let reduceMotion: ((on: boolean) => void) | null = null;
beforeAll(() => {
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_t, h) => {
    reduceMotion = h as (on: boolean) => void;
    return { remove: () => {} } as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
});
beforeEach(() => {
  mockAnim.repeats = 0;
  mockAnim.cancels = 0;
  appState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, h) => {
    appState = h as (s: AppStateStatus) => void;
    return { remove: () => {} } as ReturnType<typeof AppState.addEventListener>;
  });
});
afterEach(() => {
  (AppState.addEventListener as jest.Mock).mockRestore?.();
  (AppState as { currentState: unknown }).currentState = 'active';
});
function setAppState(st: AppStateStatus) {
  (AppState as { currentState: unknown }).currentState = st;
  appState!(st);
}

const TODAY = '2026-10-14';
const task: Task = { id: 'a', title: 'Annemi ara', date: TODAY, time: null, done: false, failed: false, createdAt: 1, categoryId: null, recurrenceId: null };
const noop = () => {};
const panel = (alertOnScreen: boolean) => (
  <DayPanel
    date={new Date(2026, 9, 14)}
    ymd={TODAY}
    index={2}
    todayYmd={TODAY}
    tasks={[task]}
    loading={false}
    lateCount={2}
    alertOnScreen={alertOnScreen}
    flash={null}
    onAdd={noop}
    onToggle={noop}
    onOpen={noop}
    onFail={noop}
    onShowLate={noop}
    onLayoutY={noop}
  />
);

it('pulses while visible, pauses in the background and off-screen, resumes after', async () => {
  const r = await render(panel(true));
  expect(mockAnim.repeats).toBe(1);

  await act(async () => setAppState('background'));
  expect(mockAnim.cancels).toBe(1);
  await act(async () => setAppState('active'));
  expect(mockAnim.repeats).toBe(2);

  await r.rerender(panel(false));
  expect(mockAnim.cancels).toBe(2);
  await r.rerender(panel(true));
  expect(mockAnim.repeats).toBe(3);
});

it('stops, and never starts, with reduced motion', async () => {
  const r = await render(panel(true));
  expect(mockAnim.repeats).toBe(1);
  await act(async () => reduceMotion!(true));
  expect(mockAnim.cancels).toBe(1);
  await r.unmount();
  mockAnim.repeats = 0;
  await render(panel(true));
  expect(mockAnim.repeats).toBe(0);
  await act(async () => reduceMotion!(false));
  expect(mockAnim.repeats).toBe(1);
});
