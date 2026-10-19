import { setAudioModeAsync, useAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

export type HapticKind = 'light' | 'medium' | null;

// The audio mode is global: set it once for all of the app's sound players.
let audioModeSet = false;

/**
 * Replays `player` from the start, plus the haptic. Never throws.
 * seekTo and play are issued back to back, without waiting for the seek's promise: on Android
 * both run on the main queue in call order (seek, then play), so the clip still starts from 0,
 * but the press no longer waits for the seek's round trip back to JS before the sound starts.
 */
function replay(player: AudioPlayer, volume: number, haptic: HapticKind) {
  try {
    player.volume = volume;
  } catch { /* audio unavailable */ }
  try {
    player.seekTo(0).catch(() => {});
  } catch { /* not loaded / released: play anyway */ }
  try {
    player.play();
  } catch { /* audio unavailable */ }
  if (haptic && Platform.OS !== 'web') {
    const style = haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
    Haptics.impactAsync(style).catch(() => {});
  }
}

/**
 * Returns a callback that plays a short UI sound (preloaded once, replayed from the
 * start each time) plus an optional haptic tap. Never throws; a missing audio
 * device just means silence.
 */
export function useSoundEffect(source: AudioSource, opts: { volume?: number; haptic?: HapticKind } = {}): () => void {
  const player = useAudioPlayer(source);
  const volume = opts.volume ?? 0.8;
  const haptic = opts.haptic ?? null;

  useEffect(() => {
    if (audioModeSet) return;
    audioModeSet = true;
    // Don't stop the user's music for a short UI sound.
    setAudioModeAsync({ interruptionMode: 'mixWithOthers' }).catch(() => {});
  }, []);

  return useCallback(() => replay(player, volume, haptic), [player, volume, haptic]);
}
