import { memo, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { C, F, G, SH, TS } from '../theme';
import { Rivet } from './icons';
import { useSounds, type SoundName } from './Sfx';

/**
 * Sound of a press. Every pressable plays `tap` unless it names a specific sound, or
 * passes `null` when the handler plays its own (outcome-dependent) sound — so one press
 * never plays two sounds.
 */
export type PressSound = SoundName | null;

/** Pressable that plays its press sound (default `tap`) before calling onPress. */
export function Tappable({ sound = 'tap', onPress, ...rest }: PressableProps & { sound?: PressSound }) {
  const sfx = useSounds();
  const handle = onPress
    ? (e: GestureResponderEvent) => {
        if (sound) sfx[sound]();
        onPress(e);
      }
    : undefined;
  return <Pressable {...rest} onPress={handle} />;
}

/** Four corner rivets (the ::after layer of .prov / .event / .dw-face). */
export const Rivets = memo(function Rivets({ inset = 4 }: { inset?: number }) {
  const pos = inset === 4 ? RIVET_POS_4 : rivetPos(inset);
  return (
    <>
      <View pointerEvents="none" style={pos[0]}><Rivet /></View>
      <View pointerEvents="none" style={pos[1]}><Rivet /></View>
      <View pointerEvents="none" style={pos[2]}><Rivet /></View>
      <View pointerEvents="none" style={pos[3]}><Rivet /></View>
    </>
  );
});

function rivetPos(inset: number): StyleProp<ViewStyle>[] {
  return [
    [s.rivet, { top: inset, left: inset }],
    [s.rivet, { top: inset, right: inset }],
    [s.rivet, { bottom: inset, left: inset }],
    [s.rivet, { bottom: inset, right: inset }],
  ];
}

/**
 * 3px gradient "gold frame" border (CSS `border:3px solid transparent` +
 * `var(--gold-frame) border-box`), with a panel gradient inside and corner rivets.
 */
export function GoldFrame({
  children,
  style,
  innerStyle,
  frame = G.goldFrame,
  fill,
  fillColor,
  shadow,
  rivets = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  frame?: string;
  fill?: string;
  fillColor?: string;
  shadow?: string;
  rivets?: boolean;
}) {
  // Stable layer styles: a re-render with the same tokens hands the renderer the same objects.
  const frameStyle = useMemo(() => ({ backgroundImage: frame, boxShadow: shadow }), [frame, shadow]);
  const fillStyle = useMemo(() => ({ backgroundColor: fillColor, backgroundImage: fill }), [fillColor, fill]);
  return (
    <View style={[s.frame, frameStyle, style]}>
      <View style={[fillStyle, innerStyle]}>{children}</View>
      {rivets && <Rivets />}
    </View>
  );
}

/** .mbtn — bevelled metal button. */
export function MetalButton({
  children,
  style,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { children: ReactNode; style?: StyleProp<ViewStyle>; sound?: PressSound }) {
  return (
    <Tappable
      hitSlop={2}
      {...rest}
      style={({ pressed }) => [s.mbtn, pressed && s.mbtnDown, style]}
    >
      {children}
    </Tappable>
  );
}

type OptKind = 'yes' | 'no' | 'danger';

/** .opt — EU4 event option button with an icon tile, label and italic sub-line. */
export function OptionButton({
  kind,
  icon,
  label,
  sub,
  onPress,
  disabled,
  sound = 'tap',
}: {
  kind: OptKind;
  icon: ReactNode;
  label: string;
  sub?: string;
  onPress: () => void;
  disabled?: boolean;
  /** Press sound; `null` when onPress plays its own (e.g. add / error). */
  sound?: PressSound;
}) {
  return (
    <Tappable
      sound={sound}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        s.opt,
        kind === 'danger' && s.optDanger,
        pressed && (kind === 'danger' ? s.optDangerDown : s.optDown),
        disabled && s.optDisabled,
      ]}
    >
      <View style={[s.oi, kind === 'yes' && s.oiYes, kind === 'no' && s.oiNo, kind === 'danger' && s.oiDanger]}>
        {icon}
      </View>
      <View style={s.optText}>
        <Text style={s.optLabel}>{label}</Text>
        {sub ? <Text style={[s.optSub, kind === 'danger' && s.optSubDanger]}>{sub}</Text> : null}
      </View>
    </Tappable>
  );
}

const s = StyleSheet.create({
  rivet: { position: 'absolute', width: 8, height: 8, zIndex: 2 },
  frame: { padding: 3, borderRadius: 2, backgroundColor: C.goldMid },
  mbtn: {
    minHeight: 48,
    minWidth: 46,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#36404b',
    backgroundImage: G.metal,
    borderWidth: 1,
    borderColor: C.goldMid,
    borderRadius: 2,
    boxShadow: SH.metal,
  },
  mbtnDown: { backgroundImage: G.metalDown, boxShadow: SH.metalDown, transform: [{ translateY: 1 }] },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 50,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 9,
    paddingRight: 14,
    backgroundColor: '#2f3741',
    backgroundImage: G.opt,
    borderWidth: 1,
    borderColor: C.goldMid,
    borderRadius: 2,
    boxShadow: SH.opt,
  },
  optDanger: { borderColor: '#e0705c', backgroundColor: '#45160f', backgroundImage: G.optDanger },
  optDown: { transform: [{ translateY: 1 }], backgroundImage: G.metalDown, boxShadow: SH.optDown },
  optDangerDown: { transform: [{ translateY: 1 }], boxShadow: SH.optDown },
  optDisabled: { opacity: 0.6 },
  optText: { flex: 1, minWidth: 0 },
  oi: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000',
    boxShadow: SH.oi,
  },
  oiYes: { backgroundColor: '#25481b', backgroundImage: G.oiYes },
  oiNo: { backgroundColor: '#3f4853', backgroundImage: G.oiNo },
  oiDanger: { backgroundColor: '#8a2419', backgroundImage: G.oiDanger, boxShadow: SH.oiDanger },
  optLabel: { fontFamily: F.body700, fontSize: 17, lineHeight: 20.4, letterSpacing: 0.17, color: C.cream, ...TS },
  optSub: { fontFamily: F.body400i, fontSize: 13.5, lineHeight: 16.2, color: '#b9c1ca' },
  optSubDanger: { color: '#f0b8aa' },
});

/** Default corner positions, built once (after `s`). */
const RIVET_POS_4 = rivetPos(4);
