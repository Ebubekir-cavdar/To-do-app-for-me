import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { ymd } from '../lib/dates';

/** ms until just after the next local midnight (local calendar, so DST days are right). */
function msToMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 500);
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * Today's local `YYYY-MM-DD`. One timer fires just after the next midnight (no polling),
 * and the date is re-checked whenever the app returns to the foreground: JS timers are
 * paused in the background, and Android's timer clock does not advance while the phone
 * sleeps, so a midnight passed meanwhile is caught on resume. No timer runs while the app
 * is in the background.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => ymd(new Date()));
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      const now = ymd(new Date());
      setToday((prev) => (prev === now ? prev : now));
    };
    const arm = () => {
      if (t !== null) clearTimeout(t);
      t = setTimeout(() => {
        t = null;
        check();
        arm();
      }, msToMidnight());
    };
    arm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        check();
        arm();
      } else if (s === 'background' && t !== null) {
        clearTimeout(t);
        t = null;
      }
    });
    return () => {
      if (t !== null) clearTimeout(t);
      sub.remove();
    };
  }, []);
  return today;
}
