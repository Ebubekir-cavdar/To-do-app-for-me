import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSoundEffect } from '../hooks/useSoundEffect';

/** UI sound names (the user's chosen clips in assets/sounds). */
export type SoundName = 'tap' | 'add' | 'del' | 'undo' | 'error' | 'done' | 'ferman' | 'fail';

/**
 * Clip of the `fail` sound (a task marked as failed): "kırılan mühür + boğuk vuruş",
 * chosen by the user (sounds-lab/synth.py fail_a).
 */
export const FAIL_SOUND = require('../../assets/sounds/fail.wav');

export type Sfx = Record<SoundName, () => void> & {
  /** "Dokunma sesi" setting: when false, `tap` is silent (every other sound still plays). */
  tapEnabled: boolean;
  /** Persists the setting per device. Turning it on plays one tap as confirmation. */
  setTapEnabled: (on: boolean) => void;
};

/** AsyncStorage key of the "Dokunma sesi" setting: 'on' | 'off' (missing = on). */
export const TAP_SOUND_KEY = 'settings.tapSound';

const noop = () => {};
const SILENT: Sfx = {
  tap: noop, add: noop, del: noop, undo: noop, error: noop, done: noop, ferman: noop, fail: noop,
  tapEnabled: true,
  setTapEnabled: noop,
};
const SILENT_SOUNDS: Record<SoundName, () => void> = SILENT;

const SfxContext = createContext<Sfx>(SILENT);
/** The play callbacks only: never changes after mount, so pressables don't re-render on the setting. */
const SoundsContext = createContext<Record<SoundName, () => void>>(SILENT_SOUNDS);

/** Sound effects of the app; silent outside <SfxProvider> (e.g. isolated component tests). */
export function useSfx(): Sfx {
  return useContext(SfxContext);
}

/** Just the play callbacks (stable for the app's lifetime) — what pressables need. */
export function useSounds(): Record<SoundName, () => void> {
  return useContext(SoundsContext);
}

/** Sounds whose players are created after the first frame (tap and done are needed right away). */
type LateName = 'add' | 'del' | 'undo' | 'error' | 'ferman' | 'fail';
type LatePlayers = Record<LateName, () => void>;

/** Runs `cb` once the first frame is drawn and the JS thread is idle. Returns a canceller. */
function afterFirstFrameIdle(cb: () => void): () => void {
  const g = globalThis as {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (h: number) => void;
  };
  let idle: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const raf = requestAnimationFrame(() => {
    if (typeof g.requestIdleCallback === 'function') idle = g.requestIdleCallback(cb, { timeout: 1500 });
    else timer = setTimeout(cb, 250);
  });
  return () => {
    cancelAnimationFrame(raf);
    if (idle !== null) g.cancelIdleCallback?.(idle);
    if (timer !== null) clearTimeout(timer);
  };
}

/**
 * Owns exactly one preloaded player per UI sound for the whole app. Mount once, high up
 * (inside SafeAreaProvider, around both the sign-in screen and the app).
 * Haptics: done → light, ferman and fail → medium, everything else none.
 *
 * Startup: only `tap` and `done` load with the first render; the other six players are
 * created after the first frame, when the JS thread is idle. A sound asked for before its
 * player exists is queued and played as soon as the player is created — never dropped.
 */
export function SfxProvider({ children }: { children: ReactNode }) {
  const tapSound = useSoundEffect(require('../../assets/sounds/tap.wav'), { volume: 0.6 });
  const done = useSoundEffect(require('../../assets/sounds/done.mp3'), { volume: 0.8, haptic: 'light' });

  const [lateMounted, setLateMounted] = useState(false);
  const late = useRef<LatePlayers | null>(null);
  const queued = useRef<LateName[]>([]);

  useEffect(() => afterFirstFrameIdle(() => setLateMounted(true)), []);

  const playLate = useCallback((name: LateName) => {
    if (late.current) late.current[name]();
    else {
      queued.current.push(name);
      setLateMounted(true);
    }
  }, []);
  const onLateReady = useCallback((players: LatePlayers) => {
    late.current = players;
    const q = queued.current;
    queued.current = [];
    q.forEach((n) => players[n]());
  }, []);

  const add = useCallback(() => playLate('add'), [playLate]);
  const del = useCallback(() => playLate('del'), [playLate]);
  const undo = useCallback(() => playLate('undo'), [playLate]);
  const error = useCallback(() => playLate('error'), [playLate]);
  const ferman = useCallback(() => playLate('ferman'), [playLate]);
  const fail = useCallback(() => playLate('fail'), [playLate]);

  const [tapEnabled, setTapState] = useState(true);
  // Read through a ref so `tap` stays a stable callback across setting changes.
  const tapOn = useRef(true);
  const userChose = useRef(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(TAP_SOUND_KEY)
      .then((v) => {
        // A choice made while the setting was still loading wins over the stored value.
        if (!alive || userChose.current || v === null) return;
        tapOn.current = v !== 'off';
        setTapState(v !== 'off');
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const tap = useCallback(() => {
    if (tapOn.current) tapSound();
  }, [tapSound]);

  const setTapEnabled = useCallback(
    (on: boolean) => {
      userChose.current = true;
      const was = tapOn.current;
      tapOn.current = on;
      setTapState(on);
      if (on && !was) tapSound();
      AsyncStorage.setItem(TAP_SOUND_KEY, on ? 'on' : 'off').catch((e) => console.warn('[settings] save failed', e));
    },
    [tapSound],
  );

  const sounds = useMemo(
    () => ({ tap, add, del, undo, error, done, ferman, fail }),
    [tap, add, del, undo, error, done, ferman, fail],
  );
  const value = useMemo<Sfx>(() => ({ ...sounds, tapEnabled, setTapEnabled }), [sounds, tapEnabled, setTapEnabled]);
  return (
    <SoundsContext.Provider value={sounds}>
      <SfxContext.Provider value={value}>
        {children}
        {lateMounted && <LateSounds onReady={onLateReady} />}
      </SfxContext.Provider>
    </SoundsContext.Provider>
  );
}

/** The deferred players; mounted once, after the first frame (or at the first request). */
function LateSounds({ onReady }: { onReady: (p: LatePlayers) => void }) {
  const add = useSoundEffect(require('../../assets/sounds/add.wav'), { volume: 0.8 });
  const del = useSoundEffect(require('../../assets/sounds/delete.wav'), { volume: 0.8 });
  const undo = useSoundEffect(require('../../assets/sounds/undo.wav'), { volume: 0.8 });
  const error = useSoundEffect(require('../../assets/sounds/error.wav'), { volume: 0.8 });
  const ferman = useSoundEffect(require('../../assets/sounds/ferman.mp3'), { volume: 0.85, haptic: 'medium' });
  const fail = useSoundEffect(FAIL_SOUND, { volume: 0.8, haptic: 'medium' });
  useEffect(() => {
    onReady({ add, del, undo, error, ferman, fail });
  }, [onReady, add, del, undo, error, ferman, fail]);
  return null;
}
