/// <reference types="jest" />
import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useToday } from '../useToday';

let appStateHandler: ((s: AppStateStatus) => void) | null = null;
const remove = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  appStateHandler = null;
  remove.mockClear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (s: AppStateStatus) => void;
    return { remove } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('rolls over at midnight', async () => {
  jest.setSystemTime(new Date(2026, 9, 18, 23, 59, 30));
  const { result } = await renderHook(() => useToday());
  expect(result.current).toBe('2026-10-18');
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(result.current).toBe('2026-10-19');
});

it('re-checks immediately when the app comes back to the foreground', async () => {
  jest.setSystemTime(new Date(2026, 9, 18, 22, 0));
  const { result } = await renderHook(() => useToday());
  expect(result.current).toBe('2026-10-18');
  // Phone slept overnight: the wall clock moved but no timer fired.
  jest.setSystemTime(new Date(2026, 9, 19, 8, 0));
  await act(async () => appStateHandler!('background'));
  expect(result.current).toBe('2026-10-18');
  await act(async () => appStateHandler!('active'));
  expect(result.current).toBe('2026-10-19');
});

it('rolls over at the next midnight even after days in the foreground', async () => {
  jest.setSystemTime(new Date(2026, 9, 18, 9, 0));
  const { result } = await renderHook(() => useToday());
  await act(async () => { jest.advanceTimersByTime(15 * 3600 * 1000 - 1000); }); // 23:59:59
  expect(result.current).toBe('2026-10-18');
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(result.current).toBe('2026-10-19');
  await act(async () => { jest.advanceTimersByTime(24 * 3600 * 1000); });
  expect(result.current).toBe('2026-10-20');
});

/** The hook's own timers: React's scheduler also uses (0 ms) timeouts under jest. */
function longTimers() {
  const st = jest.spyOn(globalThis, 'setTimeout');
  const ct = jest.spyOn(globalThis, 'clearTimeout');
  const armed = () => st.mock.calls.flatMap((c, i) => ((c[1] ?? 0) >= 1000 ? [st.mock.results[i].value] : []));
  const live = () => armed().filter((id) => !ct.mock.calls.some((c) => c[0] === id)).length;
  return { armed, live };
}

it('keeps exactly one timer while active, none in the background (no polling)', async () => {
  jest.setSystemTime(new Date(2026, 9, 18, 9, 0));
  const timers = longTimers();
  await renderHook(() => useToday());
  expect(timers.armed()).toHaveLength(1);
  // An hour later nothing has fired: no minute polling.
  await act(async () => { jest.advanceTimersByTime(60 * 60 * 1000); });
  expect(timers.armed()).toHaveLength(1);
  await act(async () => appStateHandler!('background'));
  expect(timers.live()).toBe(0);
  await act(async () => appStateHandler!('active'));
  expect(timers.live()).toBe(1);
});

it('cleans up the timer and the AppState listener on unmount', async () => {
  const timers = longTimers();
  const { unmount } = await renderHook(() => useToday());
  expect(timers.live()).toBe(1);
  await unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  expect(timers.live()).toBe(0);
});
