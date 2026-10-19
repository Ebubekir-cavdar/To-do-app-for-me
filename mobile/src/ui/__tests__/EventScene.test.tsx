/// <reference types="jest" />
import { act, renderHook } from '@testing-library/react-native';
import { useAfterFirstFrame } from '../EventScene';

let mockReduced = false;
jest.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

beforeEach(() => {
  jest.useFakeTimers();
  mockReduced = false;
});
afterEach(() => jest.useRealTimers());

it('draws the vignette from the frame after the popup content first commits', async () => {
  const { result } = await renderHook(() => useAfterFirstFrame());
  expect(result.current).toBe(false);
  await act(async () => { jest.advanceTimersByTime(20); });
  expect(result.current).toBe(true);
});

it('draws it at once with reduced motion (no fade-in to hide the frame)', async () => {
  mockReduced = true;
  const { result, rerender } = await renderHook(() => useAfterFirstFrame());
  expect(result.current).toBe(true);
  // Stays drawn if the setting changes while the popup is open.
  mockReduced = false;
  await rerender({});
  expect(result.current).toBe(true);
});

it('cancels the pending frame when the popup closes first', async () => {
  const cancel = jest.spyOn(globalThis, 'cancelAnimationFrame');
  const { unmount } = await renderHook(() => useAfterFirstFrame());
  await unmount();
  expect(cancel).toHaveBeenCalled();
  cancel.mockRestore();
});
