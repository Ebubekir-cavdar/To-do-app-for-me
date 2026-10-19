/// <reference types="jest" />
/**
 * Android renders `backgroundImage` / `boxShadow` through React Native's own CSS parsers
 * (web passes the strings straight to the browser). A value RN can't parse is silently
 * dropped on the phone, so every theme token must parse to one entry per CSS layer.
 */
import { G, SH } from '..';

// RN internals without .d.ts files — the exact parsers StyleSheet uses on Android.
type Parser = (value: string) => unknown[];
const processBackgroundImage: Parser = require('react-native/Libraries/StyleSheet/processBackgroundImage').default;
const processBoxShadow: Parser = require('react-native/Libraries/StyleSheet/processBoxShadow').default;

/** Number of comma-separated top-level layers (commas inside rgba()/gradients don't count). */
function layers(s: string): number {
  let depth = 0;
  let n = 1;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) n++;
  }
  return n;
}

describe('theme tokens parse with React Native style processors', () => {
  it.each(Object.entries(G))('backgroundImage G.%s', (_name, value) => {
    const parsed = processBackgroundImage(value);
    expect(parsed).toHaveLength(layers(value));
  });

  it.each([...Object.entries(SH), ['DayPanel alertGlow', '0 0 8px 2px rgba(255,106,82,0.9)']])(
    'boxShadow SH.%s',
    (_name, value) => {
      const parsed = processBoxShadow(value);
      expect(parsed).toHaveLength(layers(value));
    },
  );
});
