import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// Cached so components mounted later start with the right value (no animate-then-snap).
let cached = false;
let started = false;
const subs = new Set<() => void>();
const set = (v: boolean) => {
  if (v === cached) return;
  cached = v;
  subs.forEach((s) => s());
};

function start() {
  if (started) return;
  started = true;
  AccessibilityInfo.isReduceMotionEnabled().then(set).catch(() => {});
  AccessibilityInfo.addEventListener('reduceMotionChanged', set);
}

function subscribe(cb: () => void) {
  subs.add(cb);
  return () => { subs.delete(cb); };
}
const getSnapshot = () => cached;

/** OS "reduce motion" setting (prefers-reduced-motion), kept live. */
export function useReducedMotion(): boolean {
  start();
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
