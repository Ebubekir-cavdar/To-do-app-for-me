import { createContext, memo, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { C, F, G } from '../theme';

/** Warband-style message log (lower left): done / undo / add / del / ferman / fail lines. */
export type LogKind = 'done' | 'undo' | 'add' | 'del' | 'ferman' | 'fail';

const COLOR: Record<LogKind, string> = {
  done: C.greenHi,
  undo: C.goldHi,
  add: '#f3e7c6',
  del: C.redHi,
  ferman: C.goldHi,
  // Blood red, deeper than del's bright red; still legible on the dark log plate.
  fail: '#d9493a',
};
/** Left rule colour where it differs from the text (Ferman: gold rule; fail: dark blood-red rule). */
const RULE: Partial<Record<LogKind, string>> = { ferman: C.gold, fail: '#7a140b' };
const MAX_LINES = 5;
const FADE_AT = 3600;
const REMOVE_AT = 4600;

type Line = { id: number; text: string; kind: LogKind };

const LogContext = createContext<(text: string, kind: LogKind) => void>(() => {});

export function useLog() {
  return useContext(LogContext);
}

export function LogProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Line[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const set = timers.current;
    return () => set.forEach(clearTimeout);
  }, []);

  const log = useCallback((text: string, kind: LogKind) => {
    const id = ++seq.current;
    setLines((prev) => [...prev, { id, text, kind }].slice(-MAX_LINES));
    const t = setTimeout(() => {
      timers.current.delete(t);
      setLines((prev) => prev.filter((l) => l.id !== id));
    }, REMOVE_AT);
    timers.current.add(t);
  }, []);

  return (
    <LogContext.Provider value={log}>
      {children}
      <LogOverlay lines={lines} />
    </LogContext.Provider>
  );
}

function LogOverlay({ lines }: { lines: Line[] }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const left = Math.max(10, width / 2 - 205);
  return (
    <View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[s.log, { bottom: 14 + insets.bottom, left, width: Math.min(320, width - 20) }]}
    >
      {lines.map((l) => (
        <LogLine key={l.id} line={l} />
      ))}
    </View>
  );
}

/** Memoized: a new line arriving doesn't re-render (or re-animate) the ones already shown. */
const LogLine = memo(function LogLine({ line }: { line: Line }) {
  const reduced = useReducedMotion();
  const inP = useSharedValue(reduced ? 1 : 0);
  const outP = useSharedValue(0);

  useEffect(() => {
    if (!reduced) inP.set(withTiming(1, { duration: 250, easing: Easing.out(Easing.ease) }));
    // JS timer, not withDelay: Reanimated skips delays when the OS asks for reduced motion.
    const t = setTimeout(() => {
      outP.set(reduced ? 1 : withTiming(1, { duration: 900, easing: Easing.ease }));
    }, FADE_AT);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => ({
    opacity: inP.get() * (1 - outP.get()),
    transform: [{ translateX: (1 - inP.get()) * -12 }, { translateY: outP.get() * -4 }],
  }));

  const color = COLOR[line.kind];
  return (
    <Animated.View style={[s.line, { borderLeftColor: RULE[line.kind] ?? color }, anim]}>
      <Text style={[s.text, { color }]}>{line.text}</Text>
    </Animated.View>
  );
});

const s = StyleSheet.create({
  log: { position: 'absolute', zIndex: 60, flexDirection: 'column', alignItems: 'flex-start', gap: 3 },
  line: {
    maxWidth: '100%',
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 9,
    paddingRight: 10,
    backgroundImage: G.logLine,
    borderLeftWidth: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  text: {
    fontFamily: F.body700,
    fontSize: 15.5,
    lineHeight: 20,
    textShadowColor: '#000',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
});
