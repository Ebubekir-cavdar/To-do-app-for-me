import { StyleSheet, Text } from 'react-native';
import { C, F, G, SH, TS } from '../theme';
import { Tappable, type PressSound } from './primitives';

/**
 * Toggle chip on the parchment: inset parchment when off, bevelled metal when on.
 * Used for the Ferman day / span selectors and the "Dokunma sesi" setting.
 */
export function Chip({
  label,
  a11y,
  on,
  radio,
  onPress,
  style,
  sound,
  disabled,
}: {
  label: string;
  a11y?: string;
  on: boolean;
  radio?: boolean;
  onPress: () => void;
  style?: object;
  /** Press sound (default tap); null when onPress plays its own. */
  sound?: PressSound;
  disabled?: boolean;
}) {
  return (
    <Tappable
      sound={sound}
      role={radio ? 'radio' : 'checkbox'}
      aria-checked={on}
      accessibilityLabel={a11y ?? label}
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={2}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && (on ? s.chipOnDown : s.chipDown), disabled && s.chipOff, style]}
    >
      <Text style={[s.chipTxt, on && s.chipTxtOn]} numberOfLines={1}>{label}</Text>
    </Tappable>
  );
}

const s = StyleSheet.create({
  chip: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,250,232,0.62)',
    borderWidth: 1,
    borderColor: '#8a6f45',
    borderRadius: 2,
    boxShadow: SH.inp,
  },
  chipOff: { opacity: 0.45 },
  chipDown: { backgroundColor: 'rgba(255,252,240,0.9)' },
  chipOn: {
    backgroundColor: '#36404b',
    backgroundImage: G.metal,
    borderColor: C.goldMid,
    boxShadow: SH.metal,
  },
  chipOnDown: { backgroundImage: G.metalDown, boxShadow: SH.metalDown, transform: [{ translateY: 1 }] },
  chipTxt: { fontFamily: F.sc700, fontSize: 15, lineHeight: 18, color: C.inkSoft },
  chipTxtOn: { color: C.goldHi, ...TS },
});
