/// <reference types="jest" />
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { MetalButton, OptionButton } from '../primitives';
import { FAIL_SOUND, SfxProvider, TAP_SOUND_KEY, useSfx, type Sfx } from '../Sfx';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// jest-expo stubs every asset with the same value; give each clip its own identity.
jest.mock('../../../assets/sounds/tap.wav', () => ({ clip: 'tap' }));
jest.mock('../../../assets/sounds/add.wav', () => ({ clip: 'add' }));
jest.mock('../../../assets/sounds/delete.wav', () => ({ clip: 'del' }));
jest.mock('../../../assets/sounds/undo.wav', () => ({ clip: 'undo' }));
jest.mock('../../../assets/sounds/error.wav', () => ({ clip: 'error' }));
jest.mock('../../../assets/sounds/fail.wav', () => ({ clip: 'fail' }));
jest.mock('../../../assets/sounds/done.mp3', () => ({ clip: 'done' }));
jest.mock('../../../assets/sounds/ferman.mp3', () => ({ clip: 'ferman' }));

// One fake player per audio source, so plays can be counted per sound.
jest.mock('expo-audio', () => {
  const players = new Map<unknown, { source: unknown; volume: number; seekTo: jest.Mock; play: jest.Mock }>();
  return {
    __players: players,
    useAudioPlayer: jest.fn((source: unknown) => {
      if (!players.has(source)) {
        players.set(source, { source, volume: 1, seekTo: jest.fn(() => Promise.resolve()), play: jest.fn() });
      }
      return players.get(source);
    }),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

const audio = jest.requireMock('expo-audio') as any;
const haptics = jest.requireMock('expo-haptics') as any;

const SOURCES: Record<string, unknown> = {
  tap: require('../../../assets/sounds/tap.wav'),
  add: require('../../../assets/sounds/add.wav'),
  del: require('../../../assets/sounds/delete.wav'),
  undo: require('../../../assets/sounds/undo.wav'),
  error: require('../../../assets/sounds/error.wav'),
  fail: require('../../../assets/sounds/fail.wav'),
  done: require('../../../assets/sounds/done.mp3'),
  ferman: require('../../../assets/sounds/ferman.mp3'),
};
const plays = (name: string) => audio.__players.get(SOURCES[name])?.play.mock.calls.length ?? 0;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

let sfx: Sfx;
function Grab() {
  sfx = useSfx(); // eslint-disable-line react-hooks/globals -- test probe exposes the context
  return <Text>{sfx.tapEnabled ? 'tap-on' : 'tap-off'}</Text>;
}

beforeEach(async () => {
  jest.clearAllMocks();
  audio.__players.clear();
  await AsyncStorage.clear();
});

it('owns exactly one player per sound, with haptics only for done (light) and ferman (medium)', async () => {
  await render(<SfxProvider><Grab /></SfxProvider>);
  await flush();
  expect(new Set(Object.values(SOURCES)).size).toBe(8);
  await waitFor(() => expect(audio.__players.size).toBe(8)); // the late six load after the first frame
  for (const src of Object.values(SOURCES)) expect(audio.__players.has(src)).toBe(true);

  for (const name of ['tap', 'add', 'del', 'undo', 'error'] as const) {
    await act(async () => { sfx[name](); });
    expect(plays(name)).toBe(1);
  }
  expect(haptics.impactAsync).not.toHaveBeenCalled();
  await act(async () => { sfx.done(); });
  expect(haptics.impactAsync).toHaveBeenLastCalledWith('light');
  await act(async () => { sfx.ferman(); });
  expect(haptics.impactAsync).toHaveBeenLastCalledWith('medium');
  expect(plays('done')).toBe(1);
  expect(plays('ferman')).toBe(1);
});

it('fail plays its own slot (FAIL_SOUND, deferred) once, with a medium haptic', async () => {
  await render(<SfxProvider><Grab /></SfxProvider>);
  await flush();
  await waitFor(() => expect(audio.__players.has(FAIL_SOUND)).toBe(true));
  const failPlays = () => audio.__players.get(FAIL_SOUND).play.mock.calls.length;
  const before = failPlays();
  const otherPlays = () => Object.values(SOURCES).filter((src) => src !== FAIL_SOUND).reduce((n: number, src) => n + (audio.__players.get(src)?.play.mock.calls.length ?? 0), 0);
  const othersBefore = otherPlays();
  await act(async () => { sfx.fail(); });
  expect(failPlays()).toBe(before + 1);
  expect(otherPlays()).toBe(othersBefore);
  expect(haptics.impactAsync).toHaveBeenCalledTimes(1);
  expect(haptics.impactAsync).toHaveBeenLastCalledWith('medium');
});

describe('startup', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());
  const created = () => [...audio.__players.keys()].map((src) => Object.keys(SOURCES).find((k) => SOURCES[k] === src)).sort();

  it('loads only tap and done with the first render, the other six after the first frame', async () => {
    await render(<SfxProvider><Grab /></SfxProvider>);
    expect(created()).toEqual(['done', 'tap']);
    await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
    expect(created()).toEqual(['add', 'del', 'done', 'error', 'fail', 'ferman', 'tap', 'undo']);
    expect(audio.useAudioPlayer.mock.calls.length).toBeGreaterThanOrEqual(8);
  });

  it('a late sound asked for before its player exists still plays, exactly once', async () => {
    await render(<SfxProvider><Grab /></SfxProvider>);
    expect(audio.__players.has(SOURCES.ferman)).toBe(false);
    await act(async () => { sfx.ferman(); sfx.undo(); });
    expect(plays('ferman')).toBe(1);
    expect(plays('undo')).toBe(1);
    expect(haptics.impactAsync).toHaveBeenLastCalledWith('medium');
    await act(async () => { await jest.advanceTimersByTimeAsync(2000); });
    expect(plays('ferman')).toBe(1);
    expect(audio.__players.size).toBe(8);
    await act(async () => { sfx.ferman(); });
    expect(plays('ferman')).toBe(2);
  });
});

it('defaults the tap sound to on', async () => {
  await render(<SfxProvider><Grab /></SfxProvider>);
  await flush();
  expect(screen.getByText('tap-on')).toBeTruthy();
});

it('loads a stored "off", mutes only tap, and persists changes; turning on plays one confirmation tap', async () => {
  await AsyncStorage.setItem(TAP_SOUND_KEY, 'off');
  await render(<SfxProvider><Grab /></SfxProvider>);
  await flush();
  expect(screen.getByText('tap-off')).toBeTruthy();

  await act(async () => { sfx.tap(); });
  expect(plays('tap')).toBe(0);
  for (const name of ['add', 'del', 'undo', 'error', 'done', 'ferman'] as const) {
    await act(async () => { sfx[name](); });
    expect(plays(name)).toBe(1);
  }

  await act(async () => { sfx.setTapEnabled(true); });
  expect(plays('tap')).toBe(1); // confirmation tap
  expect(await AsyncStorage.getItem(TAP_SOUND_KEY)).toBe('on');
  expect(screen.getByText('tap-on')).toBeTruthy();
  await act(async () => { sfx.setTapEnabled(true); }); // already on: silent
  expect(plays('tap')).toBe(1);
  await act(async () => { sfx.tap(); });
  expect(plays('tap')).toBe(2);

  await act(async () => { sfx.setTapEnabled(false); });
  expect(plays('tap')).toBe(2); // switching off is silent
  expect(await AsyncStorage.getItem(TAP_SOUND_KEY)).toBe('off');
  await act(async () => { sfx.tap(); });
  expect(plays('tap')).toBe(2);
});

describe('pressable primitives play exactly one sound per press', () => {
  async function press(el: React.ReactElement) {
    await render(<SfxProvider>{el}<Grab /></SfxProvider>);
    await flush();
    await fireEvent.press(screen.getByLabelText('btn'));
  }
  const all = () => Object.keys(SOURCES).reduce((n, k) => n + plays(k), 0);

  it('MetalButton taps by default', async () => {
    const onPress = jest.fn();
    await press(<MetalButton accessibilityLabel="btn" onPress={onPress}><Text>x</Text></MetalButton>);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(plays('tap')).toBe(1);
    expect(all()).toBe(1);
  });

  it('a specific sound replaces tap', async () => {
    await press(<OptionButton kind="danger" icon={null} label="btn" sound="del" onPress={() => {}} />);
    expect(plays('del')).toBe(1);
    expect(all()).toBe(1);
  });

  it('sound={null} leaves the sound to the handler', async () => {
    await press(<OptionButton kind="yes" icon={null} label="btn" sound={null} onPress={() => sfx.add()} />);
    expect(plays('add')).toBe(1);
    expect(all()).toBe(1);
  });

  it('a disabled button is silent', async () => {
    await press(<OptionButton kind="yes" icon={null} label="btn" disabled onPress={() => {}} />);
    expect(all()).toBe(0);
  });

  it('tap is muted when the setting is off', async () => {
    await AsyncStorage.setItem(TAP_SOUND_KEY, 'off');
    await press(<MetalButton accessibilityLabel="btn" onPress={() => {}}><Text>x</Text></MetalButton>);
    expect(all()).toBe(0);
  });
});
