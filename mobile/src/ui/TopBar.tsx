import { memo, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { C, F, G, SH, TS } from '../theme';
import { ChevronIcon, CoinIcon, FermanGlyph, FlameIcon, ScalesIcon, ScrollIcon, SealIcon } from './icons';
import { GoldFrame, MetalButton, Tappable } from './primitives';

export type PipState = 'past' | 'now' | 'fut';

type Props = {
  done: number;
  open: number;
  late: number;
  pct: number;
  range: string;
  pips: PipState[];
  isCurrent: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** The date plaque: jump back to the current week / scroll to today. */
  onToday: () => void;
  onFerman: () => void;
  onAccount: () => void;
};

/** Sticky top bar: resource counters (EU4 top bar) + week date widget. */
export const TopBar = memo(function TopBar(p: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const narrow = width <= 370;
  const long = p.range.length > 18;
  const calm = p.late === 0;

  const barStyle = useMemo(() => [s.bar, { paddingTop: 6 + insets.top }], [insets.top]);

  return (
    <View style={barStyle}>
      <View style={s.res} accessibilityLabel="Haftalık durum">
        <Res style={s.flex1} icon={COIN} label={LBL.done} a11y={`Bu hafta tamamlanan görevler: ${p.done}`}>
          <Text style={[s.val, narrow && s.valNarrow]} numberOfLines={1}>{p.done}</Text>
        </Res>
        <Res style={s.flex1} icon={SCROLL} label={LBL.open} a11y={`Bu hafta açık görevler: ${p.open}`}>
          <Text style={[s.val, narrow && s.valNarrow]} numberOfLines={1}>{p.open}</Text>
        </Res>
        <Res
          style={calm ? s.flex1 : s.flex1Unrest}
          icon={calm ? FLAME_CALM : FLAME}
          label={LBL.late}
          a11y={`Tüm geciken görevler: ${p.late}`}
        >
          <Text style={[s.val, narrow && s.valNarrow, calm ? s.valCalm : s.valUnrest]} numberOfLines={1}>{p.late}</Text>
        </Res>
        <Res style={s.flex145} icon={SCALES} label={LBL.pct} a11y={`Bu haftanın tamamlanma oranı: yüzde ${p.pct}`}>
          <View style={s.meterWrap}>
            <Meter pct={p.pct} />
            <Text style={s.pct}>%{p.pct}</Text>
          </View>
        </Res>
        <MetalButton
          accessibilityRole="button"
          accessibilityLabel="Hesap ve çıkış"
          onPress={p.onAccount}
          hitSlop={SEAL_HIT}
          style={s.seal}
        >
          <SealIcon size={22} />
        </MetalButton>
      </View>

      <View style={s.dw} accessibilityLabel="Hafta seçimi">
        <MetalButton accessibilityRole="button" accessibilityLabel="Önceki hafta" onPress={p.onPrev} style={s.arrow}>
          <ChevronIcon dir="left" />
        </MetalButton>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel="Bugüne dön"
          accessibilityHint={`Gösterilen hafta: ${p.range}`}
          onPress={p.onToday}
          style={faceStyle}
        >
          {/* Away from the current week the plaque lights up (the old Bugün button's highlight). */}
          <GoldFrame
            style={s.faceFill}
            frame={p.isCurrent ? G.goldFrame : G.goldFrameToday}
            shadow={p.isCurrent ? SH.dwFace : SH.dwFaceAway}
            fill={G.dwFace}
            fillColor="#12161b"
            innerStyle={s.face}
          >
            <Text
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              style={[s.range, long && s.rangeLong, narrow && (long ? s.rangeLongNarrow : s.rangeNarrow)]}
            >
              {p.range}
            </Text>
            <View style={s.pips}>
              {p.pips.map((st, i) => (
                <View key={i} style={[s.pip, st === 'past' && s.pipPast, st === 'now' && s.pipNow]} />
              ))}
            </View>
          </GoldFrame>
        </Tappable>
        <MetalButton accessibilityRole="button" accessibilityLabel="Sonraki hafta" onPress={p.onNext} style={s.arrow}>
          <ChevronIcon dir="right" />
        </MetalButton>
        <MetalButton
          accessibilityRole="button"
          accessibilityLabel="Ferman çıkar"
          accessibilityHint="Belirli günlerde tekrarlanan görev ekler"
          onPress={p.onFerman}
          style={[s.fermanBtn, narrow && s.fermanBtnNarrow]}
        >
          <FermanGlyph size={narrow ? 15 : 16} />
          <Text style={[s.fermanTxt, narrow && s.fermanTxtNarrow]}>Ferman</Text>
        </MetalButton>
      </View>
    </View>
  );
});

/** A resource counter; `label` is already upper-cased (see LBL). */
function Res({
  icon,
  label,
  children,
  a11y,
  style,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  a11y: string;
  style: object;
}) {
  return (
    <View accessible accessibilityLabel={a11y} style={[s.item, style]}>
      <View style={s.itemTop}>
        {icon}
        <View style={s.itemVal}>{children}</View>
      </View>
      <Text style={s.lbl} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const Meter = memo(function Meter({ pct }: { pct: number }) {
  const reduced = useReducedMotion();
  const w = useSharedValue(pct);
  useEffect(() => {
    w.set(withTiming(pct, { duration: reduced ? 0 : 500, easing: Easing.ease }));
  }, [pct, reduced, w]);
  // scaleX instead of width: a transform animates on the UI thread without a layout pass per frame
  // (the fill's gradient is vertical, so scaling it horizontally looks the same).
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: w.get() / 100 }] }));
  return (
    <View style={s.meter}>
      <Animated.View style={[s.meterFill, fill]} />
      {TICKS.map((x, i) => (
        <View key={x} style={tickStyles[i]} />
      ))}
    </View>
  );
});

// Static elements and styles, built once.
const COIN = <CoinIcon />;
const SCROLL = <ScrollIcon />;
const FLAME = <FlameIcon calm={false} />;
const FLAME_CALM = <FlameIcon calm />;
const SCALES = <ScalesIcon />;
const SEAL_HIT = { top: 4, bottom: 4, left: 2, right: 8 };
const TICKS = [20, 40, 60, 80, 100];
/** Counter labels, upper-cased the Turkish way once (Biten → BİTEN). */
const LBL = {
  done: 'Biten'.toLocaleUpperCase('tr-TR'),
  open: 'Açık'.toLocaleUpperCase('tr-TR'),
  late: 'Geciken'.toLocaleUpperCase('tr-TR'),
  pct: 'İlerleme'.toLocaleUpperCase('tr-TR'),
};

const s = StyleSheet.create({
  bar: {
    zIndex: 20,
    paddingHorizontal: 8,
    paddingBottom: 8,
    backgroundColor: '#1b2027',
    backgroundImage: G.topbar,
    borderBottomWidth: 2,
    borderBottomColor: C.goldMid,
    boxShadow: SH.topbar,
  },
  res: { flexDirection: 'row', gap: 4 },
  item: {
    minWidth: 0,
    paddingTop: 4,
    paddingBottom: 3,
    paddingHorizontal: 6,
    backgroundColor: '#1c2129',
    backgroundImage: G.resItem,
    borderWidth: 1,
    borderColor: '#07080a',
    borderRadius: 2,
    boxShadow: SH.resItem,
    rowGap: 1,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  itemVal: { flex: 1, minWidth: 0 },
  flex1: { flex: 1 },
  flex1Unrest: { flex: 1, boxShadow: SH.resUnrest },
  flex145: { flex: 1.45 },
  valCalm: { color: C.steel },
  valUnrest: { color: '#ff8a72' },
  val: { fontFamily: F.sc700, fontSize: 18, lineHeight: 20, color: C.goldHi, ...TS },
  valNarrow: { fontSize: 16 },
  lbl: { fontFamily: F.body500, fontSize: 11, lineHeight: 12.65, letterSpacing: 0.55, color: C.steel },
  meterWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: 0 },
  meter: {
    position: 'relative',
    flex: 1,
    height: 11,
    minWidth: 24,
    backgroundColor: '#0a0c0f',
    borderWidth: 1,
    borderColor: '#000',
    boxShadow: SH.meter,
    overflow: 'hidden',
  },
  meterFill: { width: '100%', height: '100%', transformOrigin: 'left', backgroundColor: '#57a83a', backgroundImage: G.meterFill },
  meterTick: { position: 'absolute', top: 0, bottom: 0, width: 1, marginLeft: -1, backgroundColor: 'rgba(0,0,0,0.65)' },
  pct: { fontFamily: F.sc700, fontSize: 14, lineHeight: 15, color: C.greenHi, ...TS },
  seal: { minWidth: 34, width: 34, minHeight: 44 },
  dw: { marginTop: 6, flexDirection: 'row', gap: 5, alignItems: 'stretch' },
  arrow: { width: 46 },
  faceFrame: { flex: 1, minWidth: 0 },
  faceFill: { flex: 1 },
  facePressed: { transform: [{ translateY: 1 }], opacity: 0.9 },
  face: {
    flex: 1,
    paddingTop: 5,
    paddingBottom: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    boxShadow: SH.dwFaceInner,
  },
  range: {
    fontFamily: F.sc700,
    fontSize: 17,
    lineHeight: 18.7,
    color: C.goldHi,
    textAlign: 'center',
    letterSpacing: 0.34,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  rangeLong: { fontSize: 14, lineHeight: 15.4 },
  rangeNarrow: { fontSize: 16, lineHeight: 17.6 },
  rangeLongNarrow: { fontSize: 13, lineHeight: 14.3 },
  pips: { flexDirection: 'row', gap: 5 },
  pip: {
    width: 9,
    height: 9,
    transform: [{ rotate: '45deg' }],
    backgroundColor: '#2b323b',
    borderWidth: 1,
    borderColor: '#000',
    boxShadow: SH.pip,
  },
  pipPast: { backgroundColor: '#bfa05c', backgroundImage: G.pipPast },
  pipNow: { backgroundColor: '#57a83a', backgroundImage: G.pipNow, boxShadow: SH.pipNow },
  // Glyph over the label keeps the old "Bugün" button's footprint, so long week ranges still fit.
  fermanBtn: { gap: 1, paddingHorizontal: 10 },
  fermanBtnNarrow: { paddingHorizontal: 7 },
  fermanTxt: { fontFamily: F.head700, fontSize: 13, lineHeight: 15, letterSpacing: 0.78, color: C.cream, ...TS },
  fermanTxtNarrow: { fontSize: 12, lineHeight: 14, letterSpacing: 0.6 },
});

const tickStyles = TICKS.map((x) => [s.meterTick, { left: `${x}%` as const }]);
const faceStyle = ({ pressed }: { pressed: boolean }) => [s.faceFrame, pressed && s.facePressed];
