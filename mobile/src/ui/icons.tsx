/**
 * Inline SVG ornaments from designs/final.html, as react-native-svg components. All are
 * memoized: they're pure, and most take no props, so a parent re-render (a GoldFrame's
 * rivets, a top-bar counter change) never re-reconciles their SVG trees.
 */
import { memo } from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

type P = { size?: number; color?: string };

/* ---------- resource bar ---------- */
export const CoinIcon = memo(function CoinIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="rCoin" cx="0.35" cy="0.3" r="0.8">
          <Stop offset="0" stopColor="#fff2bf" />
          <Stop offset="0.5" stopColor="#e0b54f" />
          <Stop offset="1" stopColor="#7a5414" />
        </RadialGradient>
      </Defs>
      <Circle cx="12" cy="12" r="10" fill="url(#rCoin)" stroke="#2a1d08" strokeWidth="1.2" />
      <Circle cx="12" cy="12" r="6.8" fill="none" stroke="#7a5414" strokeWidth="1" />
      <Path d="M12 7.6l1.3 2.7 2.9.3-2.2 2 .7 2.9L12 14l-2.7 1.5.7-2.9-2.2-2 2.9-.3z" fill="#8a5f16" />
    </Svg>
  );
});

export const ScrollIcon = memo(function ScrollIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 4h12a2 2 0 0 1 0 4h-1v10a2 2 0 0 1-2 2H5a2 2 0 0 1 0-4h1z" fill="#ead9b0" stroke="#4a3518" strokeWidth="1.2" />
      <Path d="M18 4a2 2 0 0 0-2 2v2h2" fill="#c9ad74" stroke="#4a3518" strokeWidth="1.2" />
      <Path d="M5 16a2 2 0 0 1 2 2" fill="none" stroke="#4a3518" strokeWidth="1.2" />
      <Path d="M9 10.5h5.5M9 13.5h5.5" stroke="#7a6038" strokeWidth="1.3" />
    </Svg>
  );
});

/** Flame; `calm` renders the grayscale(1) brightness(.8) variant. */
export const FlameIcon = memo(function FlameIcon({ size = 22, calm = false }: P & { calm?: boolean }) {
  const id = calm ? 'rFlameC' : 'rFlame';
  const stops = calm ? ['#bcbcbc', '#6f6f6f', '#2a2a2a'] : ['#ffe08a', '#f2602c', '#8a140a'];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stops[0]} />
          <Stop offset="0.45" stopColor={stops[1]} />
          <Stop offset="1" stopColor={stops[2]} />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 1.8c1.2 4 6.3 6 6.3 11.4a6.3 6.3 0 0 1-12.6 0c0-3.2 2-4.6 2.6-7.3 1 1.6 1.6 2.6 1.6 4.2 1.6-1.6 2.6-4.6 2.1-8.3z"
        fill={`url(#${id})`}
        stroke={calm ? '#141414' : '#3e0905'}
        strokeWidth="1.1"
      />
      <Path d="M12 12.5c.6 1.6 2.6 2.4 2.6 4.4a2.6 2.6 0 0 1-5.2 0c0-1.2.8-1.8 1-2.8.5.6.7 1 .7 1.6.6-.8 1.1-2 .9-3.2z" fill={calm ? '#c9c9c9' : '#ffe9a8'} />
    </Svg>
  );
});

export const ScalesIcon = memo(function ScalesIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 4v15.5M7.5 20.5h9M3.5 7.5h17" stroke="#d4ad57" strokeWidth="1.7" fill="none" strokeLinecap="round" />
      <Path d="M3.5 7.5L1.4 13M3.5 7.5L5.6 13M20.5 7.5L18.4 13M20.5 7.5L22.6 13" stroke="#a9823a" strokeWidth="1" />
      <Path d="M1 13h5.2a2.6 1.8 0 0 1-5.2 0zM17.8 13H23a2.6 1.8 0 0 1-5.2 0z" fill="#c9a24e" stroke="#3a2a10" strokeWidth=".8" />
      <Circle cx="12" cy="3.6" r="1.8" fill="#f6e3a1" stroke="#3a2a10" strokeWidth=".7" />
    </Svg>
  );
});

/** Wax-seal ring used for the account control. */
export const SealIcon = memo(function SealIcon({ size = 24 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <RadialGradient id="sealG" cx="0.38" cy="0.32" r="0.75">
          <Stop offset="0" stopColor="#e2584a" />
          <Stop offset="0.6" stopColor="#a3201a" />
          <Stop offset="1" stopColor="#4e0c08" />
        </RadialGradient>
      </Defs>
      <Path
        d="M12 1.6l2.1 1.5 2.6-.2 1 2.4 2.3 1.2-.3 2.6 1.4 2.2-1.4 2.2.3 2.6-2.3 1.2-1 2.4-2.6-.2L12 22.4l-2.1-1.5-2.6.2-1-2.4L4 17.5l.3-2.6L2.9 12.7l1.4-2.2L4 7.9l2.3-1.2 1-2.4 2.6.2z"
        fill="url(#sealG)"
        stroke="#3a0805"
        strokeWidth="1"
      />
      <Circle cx="12" cy="12" r="5.6" fill="none" stroke="#f0a090" strokeOpacity=".75" strokeWidth="1" />
      <Path d="M9.2 13.6l1-4 1.8 2 1.8-2 1 4z" fill="#ffd9c8" fillOpacity=".9" />
    </Svg>
  );
});

/* ---------- buttons ---------- */
export const ChevronIcon = memo(function ChevronIcon({ size = 20, color = '#f6e3a1', dir }: P & { dir: 'left' | 'right' }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Path
        d={dir === 'left' ? 'M12.5 3.5L6 10l6.5 6.5' : 'M7.5 3.5L14 10l-6.5 6.5'}
        fill="none"
        stroke={color}
        strokeWidth="2.6"
        strokeLinecap="square"
      />
    </Svg>
  );
});

export const PlusIcon = memo(function PlusIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d="M11 3.5v15M3.5 11h15" stroke="#000" strokeOpacity=".5" strokeWidth="4.6" />
      <Path d="M11 3.5v15M3.5 11h15" stroke="#f6e3a1" strokeWidth="2.6" />
    </Svg>
  );
});

export const TickIcon = memo(function TickIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Path d="M4 11.5l4.5 4.5L18 5.5" fill="none" stroke="#0d1f08" strokeWidth="4.2" strokeLinecap="square" />
      <Path d="M4 11.5l4.5 4.5L18 5.5" fill="none" stroke="#a8ec7c" strokeWidth="2.4" strokeLinecap="square" />
    </Svg>
  );
});

/** Failed-task mark: a ✗ in the TickIcon style (dark outline, gold-to-blood-red stroke). */
export const FailIcon = memo(function FailIcon({ size = 22 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22">
      <Defs>
        <LinearGradient id="failG" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffd27a" />
          <Stop offset="0.5" stopColor="#ef6a3c" />
          <Stop offset="1" stopColor="#d22b1c" />
        </LinearGradient>
      </Defs>
      <Path d="M5.5 5.5l11 11M16.5 5.5l-11 11" fill="none" stroke="#140403" strokeWidth="4.4" strokeLinecap="square" />
      <Path d="M5.5 5.5l11 11M16.5 5.5l-11 11" fill="none" stroke="url(#failG)" strokeWidth="2.4" strokeLinecap="square" />
    </Svg>
  );
});

export const AlertIcon = memo(function AlertIcon({ size = 30 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28">
      <Defs>
        <RadialGradient id="alR" cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#ff7a5c" />
          <Stop offset="0.55" stopColor="#c0301f" />
          <Stop offset="1" stopColor="#5e0f0b" />
        </RadialGradient>
        <LinearGradient id="alG" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#fff0b5" />
          <Stop offset="0.5" stopColor="#a9823a" />
          <Stop offset="1" stopColor="#f0d38a" />
        </LinearGradient>
      </Defs>
      <Circle cx="14" cy="14" r="13" fill="url(#alG)" stroke="#1a1206" />
      <Circle cx="14" cy="14" r="10" fill="url(#alR)" stroke="#2a0805" />
      <Path d="M14 7.5v8" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
      <Circle cx="14" cy="19.8" r="1.7" fill="#fff" />
    </Svg>
  );
});

export const LateIcon = memo(function LateIcon({ size = 11 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Path d="M6 1l5 9.5H1z" fill="#ffe0a0" stroke="#4a0b05" strokeWidth=".8" />
      <Path d="M6 4.3v3" stroke="#4a0b05" strokeWidth="1.4" />
      <Circle cx="6" cy="8.9" r=".75" fill="#4a0b05" />
    </Svg>
  );
});

export const Flourish = memo(function Flourish({ mirror = false }: { mirror?: boolean }) {
  return (
    <Svg width={34} height={10} viewBox="0 0 34 10" style={mirror ? fl.mirror : fl.plain}>
      <Path d="M1 5h22c3 0 4-3 6.5-3S33 4 33 5s-1 3-3.5 3S26 5 23 5" fill="none" stroke="#6a5233" strokeWidth="1.2" />
    </Svg>
  );
});

/* ---------- option-button glyphs ---------- */
export const YesGlyph = memo(function YesGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M4 10.5l4 4 8-9" fill="none" stroke="#b8f08c" strokeWidth="2.8" strokeLinecap="square" />
    </Svg>
  );
});

export const NoGlyph = memo(function NoGlyph({ color = '#e6dcc6' }: { color?: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M5 5l10 10M15 5L5 15" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="square" />
    </Svg>
  );
});

export const TrashGlyph = memo(function TrashGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M5 6h10M8 6V4h4v2M6.5 6l.8 10h5.4l.8-10" fill="none" stroke="#fff1e8" strokeWidth="1.8" />
    </Svg>
  );
});

export const DoorGlyph = memo(function DoorGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M8 3.5h7.5v13H8" fill="none" stroke="#fff1e8" strokeWidth="1.7" />
      <Path d="M3 10h8.5M8.5 7l3 3-3 3" fill="none" stroke="#fff1e8" strokeWidth="1.8" strokeLinecap="square" />
    </Svg>
  );
});

export const GoogleGlyph = memo(function GoogleGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M17.6 10.2c0-.6-.1-1.1-.2-1.6H10v3.1h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.3-3.4 2.3-5.9z" fill="#4285F4" />
      <Path d="M10 18c2.2 0 4-.7 5.3-1.9l-2.6-2c-.7.5-1.6.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H2.8v2.1A8 8 0 0 0 10 18z" fill="#34A853" />
      <Path d="M5.5 11.6a4.8 4.8 0 0 1 0-3.1V6.4H2.8a8 8 0 0 0 0 7.2z" fill="#FBBC05" />
      <Path d="M10 5.2c1.2 0 2.2.4 3.1 1.2l2.3-2.3A8 8 0 0 0 2.8 6.4l2.7 2.1C6.1 6.6 7.9 5.2 10 5.2z" fill="#EA4335" />
    </Svg>
  );
});

/* ---------- decision-window illustrations ---------- */
export const DeleteScrollArt = memo(function DeleteScrollArt() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Rect x="9" y="12" width="34" height="36" fill="#f3e4bd" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M9 8h34a4 4 0 0 1 0 8H9a4 4 0 0 1 0-8z" fill="#d6bf8a" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M15 23h22M15 29h22M15 35h14" stroke="#8a6f45" strokeWidth="1.4" />
      <Circle cx="40" cy="43" r="9.5" fill="#a3201a" stroke="#4e0c08" strokeWidth="1.4" />
      <Circle cx="40" cy="43" r="6.2" fill="none" stroke="#d0574a" strokeWidth="1" />
      <Path d="M36.6 39.6l6.8 6.8M43.4 39.6l-6.8 6.8" stroke="#ffe0cc" strokeWidth="2" />
    </Svg>
  );
});

/** Account window art: a sealed charter. */
export const CharterArt = memo(function CharterArt() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Rect x="9" y="12" width="34" height="36" fill="#f3e4bd" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M9 8h34a4 4 0 0 1 0 8H9a4 4 0 0 1 0-8z" fill="#d6bf8a" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M15 23h22M15 29h22M15 35h14" stroke="#8a6f45" strokeWidth="1.4" />
      <Path d="M34 44l-3 10 5-3 3 4 1-10zM46 44l3 10-5-3-3 4-1-10z" fill="#7a1a12" stroke="#3a0805" strokeWidth="1" />
      <Circle cx="40" cy="42" r="9.5" fill="#a3201a" stroke="#4e0c08" strokeWidth="1.4" />
      <Circle cx="40" cy="42" r="6.2" fill="none" stroke="#d0574a" strokeWidth="1" />
      <Path d="M36.4 44.5l1.2-5 2.4 2.6 2.4-2.6 1.2 5z" fill="#ffe0cc" />
    </Svg>
  );
});

/** Corner rivet (--rivet radial gradient), 8×8. */
export const Rivet = memo(function Rivet() {
  return (
    <Svg width={8} height={8} viewBox="0 0 8 8">
      <Defs>
        <RadialGradient id="rivetG" cx="4" cy="4" r="3.8" fx="4" fy="4" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#fff1c2" />
          <Stop offset="0.26" stopColor="#fff1c2" />
          <Stop offset="0.42" stopColor="#c9a24e" />
          <Stop offset="0.68" stopColor="#5a4214" />
          <Stop offset="0.84" stopColor="#000" stopOpacity="0.55" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="4" cy="4" r="3.8" fill="url(#rivetG)" />
    </Svg>
  );
});

/* ---------- Ferman (recurring add) ---------- */
/** Small rolled decree with a wax seal — the FERMAN top-bar button glyph. */
export const FermanGlyph = memo(function FermanGlyph({ size = 16 }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Rect x="4" y="3.5" width="11" height="12.5" fill="#ead9b0" stroke="#3a2a10" strokeWidth="1.1" />
      <Rect x="2.5" y="1.6" width="14" height="3.4" rx="1.7" fill="#c9ad74" stroke="#3a2a10" strokeWidth="1.1" />
      <Rect x="2.5" y="14.6" width="14" height="3.4" rx="1.7" fill="#c9ad74" stroke="#3a2a10" strokeWidth="1.1" />
      <Path d="M6.5 8h6M6.5 10.6h4" stroke="#7a6038" strokeWidth="1.2" />
      <Circle cx="14.6" cy="13.4" r="3.6" fill="#a3201a" stroke="#3a0805" strokeWidth="1" />
      <Circle cx="14.6" cy="13.4" r="1.9" fill="none" stroke="#f0a090" strokeOpacity=".8" strokeWidth=".8" />
    </Svg>
  );
});

/** ↻ marker for tasks that belong to a Ferman series (ledger ink colours). */
export const RecurIcon = memo(function RecurIcon({ size = 13, color = '#6a5233' }: P) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14">
      <Path d="M11.6 7a4.6 4.6 0 1 1-1.35-3.25" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M11.9 1.4v3.3H8.6z" fill={color} stroke={color} strokeWidth=".8" strokeLinejoin="round" />
    </Svg>
  );
});

/** Option glyph: the seal pressed onto a decree ("Ferman İlan Et"). */
export const DecreeGlyph = memo(function DecreeGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M4 3.5h9v13H4z" fill="none" stroke="#e8f5d8" strokeWidth="1.6" />
      <Path d="M6.5 7h4M6.5 9.8h4" stroke="#e8f5d8" strokeWidth="1.3" />
      <Circle cx="13.8" cy="14" r="3.8" fill="#b8f08c" stroke="#0d1f08" strokeWidth="1" />
      <Path d="M12.2 14.1l1.2 1.2 2.1-2.4" fill="none" stroke="#0d1f08" strokeWidth="1.3" />
    </Svg>
  );
});

/** Option glyph: delete this and the following entries of a series. */
export const TrashSeriesGlyph = memo(function TrashSeriesGlyph() {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M2.5 6h9M5 6V4h4v2M3.8 6l.7 10h5l.7-10" fill="none" stroke="#fff1e8" strokeWidth="1.7" />
      <Path d="M13 7.5l2.5 2.5-2.5 2.5M16 7.5l2.5 2.5-2.5 2.5" fill="none" stroke="#fff1e8" strokeWidth="1.6" />
    </Svg>
  );
});

/** Ferman delete-window art: a sealed decree with the series arrow. */
export const FermanScrollArt = memo(function FermanScrollArt() {
  return (
    <Svg width={56} height={56} viewBox="0 0 56 56">
      <Rect x="9" y="12" width="34" height="36" fill="#f3e4bd" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M9 8h34a4 4 0 0 1 0 8H9a4 4 0 0 1 0-8z" fill="#d6bf8a" stroke="#5a4320" strokeWidth="1.4" />
      <Path d="M15 23h22M15 29h22M15 35h14" stroke="#8a6f45" strokeWidth="1.4" />
      <Circle cx="40" cy="43" r="9.5" fill="#a3201a" stroke="#4e0c08" strokeWidth="1.4" />
      <Circle cx="40" cy="43" r="6.2" fill="none" stroke="#d0574a" strokeWidth="1" />
      <Path d="M43.6 43a3.6 3.6 0 1 1-1.05-2.55" fill="none" stroke="#ffe0cc" strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M43.9 38.6v2.8h-2.8z" fill="#ffe0cc" />
    </Svg>
  );
});

const fl = StyleSheet.create({
  plain: { opacity: 0.6 },
  mirror: { opacity: 0.6, transform: [{ scaleX: -1 }] },
});
