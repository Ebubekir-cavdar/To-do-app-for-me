import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { C, EASE, F, G, SH } from '../theme';
import { GoldFrame, Tappable } from './primitives';

/**
 * EU4 "event popup" / "decision window" shell: dark scrim, gold-framed window with a
 * title bar. Android back and Escape (web) call onClose; tapping the scrim closes too.
 */
export function EventModal({
  visible,
  onClose,
  title,
  small,
  children,
  onShow,
  dismissable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  small?: boolean;
  children: ReactNode;
  onShow?: () => void;
  dismissable?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const p = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      p.set(0);
      p.set(withTiming(1, { duration: reduced ? 0 : 240, easing: Easing.bezier(...EASE.pop) }));
    }
  }, [visible, reduced, p]);

  const pop = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - p.get()) * 14 }, { scale: 0.96 + 0.04 * p.get() }],
  }));
  const contentStyle = useMemo(
    () => [s.content, { paddingTop: Math.max(height * 0.05, 14) + insets.top, paddingBottom: 20 + insets.bottom }],
    [height, insets.top, insets.bottom],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduced ? 'none' : 'fade'}
      onRequestClose={onClose}
      onShow={onShow}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <View style={s.scrim}>
        <KeyboardAvoidingView behavior="padding" style={s.fill}>
          <ScrollView
            style={s.fill}
            contentContainerStyle={contentStyle}
            keyboardShouldPersistTaps="handled"
          >
            <Tappable
              accessible={false}
              style={StyleSheet.absoluteFill}
              onPress={dismissable ? onClose : undefined}
            />
            <Animated.View
              accessibilityViewIsModal
              style={[s.window, small ? s.windowSmall : s.windowLarge, pop]}
            >
              <GoldFrame fill={G.event} fillColor="#232a33" shadow={SH.event}>
                <Text accessibilityRole="header" style={s.title}>{title}</Text>
                {children}
              </GoldFrame>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** Keeps the last non-null value so a closing modal can fade out with its content. */
export function useLatest<T>(value: T | null): T | null {
  // "Storing information from previous renders": state adjusted during render, no ref read.
  const [latest, setLatest] = useState<T | null>(value);
  if (value !== null && value !== latest) setLatest(value);
  return value !== null ? value : latest;
}

/**
 * A key that changes every time a popup opens (`open` becomes, or changes to, a non-null,
 * non-false value). Keying a popup's form with it gives each opening fresh state — on
 * every platform, even when reopened while the old window is still fading out.
 */
export function useOpenKey(open: unknown): number {
  const [state, setState] = useState({ open, key: 0 });
  if (state.open !== open) {
    setState({ open, key: open !== null && open !== false ? state.key + 1 : state.key });
  }
  return state.key;
}

/** .ev-body — parchment card inside an event window. */
export function EvBody({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[s.body, style]}>{children}</View>;
}

/** .ev-opts — column of option buttons. */
export function EvOpts({ children }: { children: ReactNode }) {
  return <View style={s.opts}>{children}</View>;
}

export const evText = StyleSheet.create({
  flavor: { marginBottom: 8, fontFamily: F.body400i, fontSize: 16, lineHeight: 22, color: C.inkSoft },
  day: { marginBottom: 4, fontFamily: F.body500, fontSize: 15, lineHeight: 19.5, color: C.ink },
  dayB: { fontFamily: F.sc700, fontSize: 16, lineHeight: 20.8, color: C.ink },
  label: { marginTop: 12, marginBottom: 5, fontFamily: F.sc700, fontSize: 14, lineHeight: 16, letterSpacing: 0.7, color: C.inkSoft },
  labelSmall: { fontFamily: F.body400i, fontSize: 13, letterSpacing: 0 },
  hint: { marginTop: 6, fontFamily: F.body700, fontSize: 14, lineHeight: 16.8, color: C.redInk },
});

const s = StyleSheet.create({
  fill: { flex: 1 },
  scrim: { flex: 1, backgroundImage: G.scrim },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 12 },
  window: { width: '100%' },
  windowSmall: { maxWidth: 350 },
  windowLarge: { maxWidth: 384 },
  title: {
    paddingTop: 11,
    paddingBottom: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
    fontFamily: F.head700,
    fontSize: 19,
    lineHeight: 22.8,
    letterSpacing: 1.14,
    color: C.goldHi,
    backgroundColor: '#363f4a',
    backgroundImage: G.evTitle,
    borderBottomWidth: 2,
    borderBottomColor: C.goldMid,
    boxShadow: SH.evTitle,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  body: {
    margin: 10,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 14,
    backgroundColor: '#e8d6aa',
    backgroundImage: G.evBody,
    boxShadow: SH.evBody,
  },
  opts: { gap: 8, paddingHorizontal: 10, paddingBottom: 12 },
});
