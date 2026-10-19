import { forwardRef, useImperativeHandle, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { normalizeTime } from '../lib/tasks';
import { NoGlyph } from './icons';
import { inp } from './inputStyles';
import { MetalButton } from './primitives';

/**
 * Apply the HH:MM mask to what the user typed. Only digits are kept, ':' is inserted
 * after the hour, and digits that can't start a valid time are refused
 * (e.g. typing 7 gives "07:", 2 then 5 keeps "2", minutes can't start with 6–9).
 */
export function maskTime(raw: string, prev: string): string {
  let digits = raw.replace(/\D/g, '');
  const deleting = raw.length < prev.length;
  // Backspace over the auto-inserted ':' also removes the hour digit before it.
  if (deleting && prev.endsWith(':') && !raw.includes(':')) digits = digits.slice(0, -1);
  let out = '';
  for (const ch of digits) {
    const n = out.replace(':', '').length;
    if (n >= 4) break;
    if (n === 0 && ch > '2') out = '0' + ch;
    else if (n === 1 && out[0] === '2' && ch > '3') continue;
    else if (n === 2 && ch > '5') continue;
    else out += ch;
    if (out.length === 2 && !out.includes(':')) out += ':';
  }
  if (deleting && out.endsWith(':') && out.length > raw.length) out = out.slice(0, -1);
  return out.slice(0, 5);
}

/**
 * Resolve the field to a stored value: '' → null (no time), "18" / "18:" → "18:00",
 * complete HH:MM → itself. Returns `undefined` when the text isn't a valid time.
 */
export function resolveTime(text: string): string | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const digits = t.replace(/\D/g, '');
  if (digits.length <= 2) return normalizeTime(digits.padStart(2, '0') + ':00') ?? undefined;
  return normalizeTime(t) ?? undefined;
}

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  error?: boolean;
};

/** Optional time input in .inp.time style with a clear button — no native picker needed. */
export const TimeField = forwardRef<ComponentRef<typeof TextInput>, Props>(function TimeField({ value, onChange, onSubmit, error }, ref) {
  const [focused, setFocused] = useState(false);
  const inner = useRef<ComponentRef<typeof TextInput>>(null);
  useImperativeHandle(ref, () => inner.current as ComponentRef<typeof TextInput>, []);
  return (
    <View style={s.row}>
      <TextInput
        ref={inner}
        value={value}
        onChangeText={(t) => onChange(maskTime(t, value))}
        placeholder="--:--"
        placeholderTextColor="#9b8762"
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={5}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Saat, isteğe bağlı, SS:DD"
        accessibilityHint="Örneğin 0930 yazın"
        style={[inp.base, s.time, focused && inp.focus, error && inp.err]}
      />
      {value ? (
        <MetalButton accessibilityLabel="Saati temizle" onPress={() => { onChange(''); inner.current?.focus(); }} style={s.clear}>
          <NoGlyph color="#f6e3a1" />
        </MetalButton>
      ) : null}
    </View>
  );
});

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  time: { width: 150, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  clear: { minHeight: 46, width: 46 },
});
