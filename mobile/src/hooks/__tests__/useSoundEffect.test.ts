/// <reference types="jest" />
import { act, renderHook } from '@testing-library/react-native';
import { useSoundEffect } from '../useSoundEffect';

const SOURCE = { uri: 'done.mp3' };
const useDoneLike = () => useSoundEffect(SOURCE, { volume: 0.8, haptic: 'light' });

jest.mock('expo-audio', () => {
  const player = { volume: 1, seekTo: jest.fn(() => Promise.resolve()), play: jest.fn() };
  return {
    __player: player,
    useAudioPlayer: jest.fn(() => player),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const audio = jest.requireMock('expo-audio') as any;
const haptics = jest.requireMock('expo-haptics') as any;

beforeEach(() => jest.clearAllMocks());

it('loads the sound once, mixes with other audio, and replays from the start each time', async () => {
  const { result, rerender } = await renderHook(() => useDoneLike());
  await rerender({});
  const first = result.current;
  expect(audio.useAudioPlayer.mock.calls.every((c: unknown[]) => c[0] === audio.useAudioPlayer.mock.calls[0][0])).toBe(true);
  expect(audio.setAudioModeAsync).toHaveBeenCalledTimes(1);
  expect(audio.setAudioModeAsync).toHaveBeenCalledWith({ interruptionMode: 'mixWithOthers' });
  expect(result.current).toBe(first); // stable callback

  for (let i = 0; i < 2; i++) {
    await act(async () => { result.current(); });
  }
  expect(audio.__player.seekTo).toHaveBeenCalledTimes(2);
  expect(audio.__player.seekTo).toHaveBeenCalledWith(0);
  expect(audio.__player.play).toHaveBeenCalledTimes(2);
  expect(audio.__player.seekTo.mock.invocationCallOrder[0]).toBeLessThan(audio.__player.play.mock.invocationCallOrder[0]);
  expect(haptics.impactAsync).toHaveBeenCalledTimes(2);
  expect(haptics.impactAsync).toHaveBeenCalledWith('light');
});

it('plays without a haptic when none is asked for', async () => {
  const { result } = await renderHook(() => useSoundEffect(SOURCE));
  await act(async () => { result.current(); });
  expect(audio.__player.play).toHaveBeenCalledTimes(1);
  expect(haptics.impactAsync).not.toHaveBeenCalled();
});

it('still plays if seeking fails, and never throws when audio is unavailable', async () => {
  const { result } = await renderHook(() => useDoneLike());
  audio.__player.seekTo.mockImplementationOnce(() => Promise.reject(new Error('not loaded')));
  await act(async () => { result.current(); });
  expect(audio.__player.play).toHaveBeenCalledTimes(1);

  audio.__player.seekTo.mockImplementationOnce(() => { throw new Error('released'); });
  await act(async () => { expect(() => result.current()).not.toThrow(); });
});

it('starts playing in the same call as the seek, without waiting for its round trip', async () => {
  const { result } = await renderHook(() => useDoneLike());
  // A seek whose promise has not come back from the native side yet.
  audio.__player.seekTo.mockImplementationOnce(() => new Promise(() => {}));
  result.current();
  expect(audio.__player.seekTo).toHaveBeenCalledWith(0);
  expect(audio.__player.play).toHaveBeenCalledTimes(1);
  expect(audio.__player.seekTo.mock.invocationCallOrder[0]).toBeLessThan(audio.__player.play.mock.invocationCallOrder[0]);
  expect(audio.__player.volume).toBe(0.8);
});
