/** Palette from designs/final.html (:root tokens). */
export const C = {
  stone0: '#0c0e11',
  stone1: '#161a20',
  slate1: '#1e242c',
  slate2: '#2a313a',
  slate3: '#3a4451',
  slate4: '#56616f',
  steel: '#97a1ad',
  goldHi: '#f6e3a1',
  gold: '#d4ad57',
  goldMid: '#a9823a',
  goldLo: '#6b4f1e',
  goldDk: '#3a2a10',
  parch: '#ead9b0',
  parch2: '#dcc692',
  ink: '#3a2814',
  inkSoft: '#6a5233',
  inkDone: '#7a6646',
  cream: '#f1e4c3',
  green: '#5aa53c',
  greenHi: '#9be06f',
  greenDk: '#1d3a15',
  red: '#c0301f',
  redHi: '#ff6a52',
  redInk: '#a3180c',
  redDk: '#3e0e09',
  /** Page background behind everything (body). */
  page: '#0b0d10',
  /** Status bar / splash / app.json backgroundColor. */
  chrome: '#1b2027',
} as const;

/** Heraldic tinctures per weekday (Mon..Sun): [light, dark]. */
export const TINCT: readonly (readonly [string, string])[] = [
  ['#3a6cb8', '#16305e'],
  ['#be3a2e', '#5a130e'],
  ['#47933f', '#1a4317'],
  ['#84469a', '#371748'],
  ['#cf9c34', '#6a4710'],
  ['#2f8f8c', '#114443'],
  ['#4a515b', '#16191d'],
];

/** CSS `saturate(s) brightness(b)` applied to a hex colour (used for past-day shields). */
export function dimColor(hex: string, sat = 0.55, bright = 0.85): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  // saturate() matrix (W3C filter effects)
  const s = sat;
  const rr = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b;
  const gg = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b;
  const bb = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * bright)));
  r = clamp(rr);
  g = clamp(gg);
  b = clamp(bb);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
