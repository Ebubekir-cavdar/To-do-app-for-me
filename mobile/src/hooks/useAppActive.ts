import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

function subscribe(cb: () => void) {
  const sub = AppState.addEventListener('change', cb);
  return () => sub.remove();
}
// 'inactive' (iOS transitions) and an unknown start state count as active: only a real
// background pauses work, so nothing flickers while the app is on screen.
const getSnapshot = () => AppState.currentState !== 'background';

/** False while the app is in the background — continuous animations pause then. */
export function useAppActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
