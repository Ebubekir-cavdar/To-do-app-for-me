import { memo, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { DAYS, MONTHS, dayLabel } from '../lib/dates';
import { isOverdue } from '../lib/tasks';
import { useAppActive } from '../hooks/useAppActive';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Task } from '../model/task';
import { C, EASE, F, G, SH, TS } from '../theme';
import { AlertIcon, Flourish, PlusIcon } from './icons';
import { GoldFrame, MetalButton, Tappable } from './primitives';
import { Shield } from './Shield';
import { TaskRow } from './TaskRow';

type Props = {
  date: Date;
  ymd: string;
  /** Weekday, Mon=0. The week screen keys panels by it and keeps them across weeks. */
  index: number;
  todayYmd: string;
  tasks: Task[];
  loading: boolean;
  /** Overdue count for the alert bar (only passed on today's panel in the current week). */
  lateCount: number;
  /** False while the alert bar is scrolled out of view: its pulse pauses. */
  alertOnScreen: boolean;
  flash: { id: string; key: number } | null;
  onAdd: (ymd: string) => void;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  /** Long-press on a task row: fail / un-fail it. */
  onFail: (t: Task) => void;
  onShowLate: () => void;
  onLayoutY: (ymd: string, index: number, y: number) => void;
};

/** Same tasks in the same order (Task objects are stable while unchanged). */
function sameTasks(a: readonly Task[], b: readonly Task[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function sameProps(a: Props, b: Props): boolean {
  for (const k in a) {
    const key = k as keyof Props;
    if (key !== 'tasks' && a[key] !== b[key]) return false;
  }
  return sameTasks(a.tasks, b.tasks);
}

/** A day as an EU4 province panel: shield, name/date, tally, "+" and the ledger. */
export const DayPanel = memo(function DayPanel(p: Props) {
  const reduced = useReducedMotion();
  const isToday = p.ymd === p.todayYmd;
  const isPast = p.ymd < p.todayYmd;
  // Failed tasks count in the total, never as done.
  const doneN = p.tasks.filter((t) => t.done).length;
  const total = p.tasks.length;

  // .week.anim .prov — staggered fade/slide in on first load (panels mount once, with the screen)
  const enter = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (enter.get() < 1) {
      enter.set(withDelay(p.index * 35, withTiming(1, { duration: 380, easing: Easing.bezier(...EASE.slide) })));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Switching weeks right away: the next week's panels show at once (they used to be re-created).
  const shownYmd = useRef(p.ymd);
  useEffect(() => {
    if (shownYmd.current === p.ymd) return;
    shownYmd.current = p.ymd;
    if (enter.get() < 1) {
      cancelAnimation(enter);
      enter.set(1);
    }
  }, [p.ymd, enter]);
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.get(),
    transform: [{ translateY: (1 - enter.get()) * 8 }],
  }));

  const onLayout = (e: LayoutChangeEvent) => p.onLayoutY(p.ymd, p.index, e.nativeEvent.layout.y);

  return (
    <Animated.View onLayout={onLayout} style={[s.wrap, isToday && s.wrapToday, enterStyle]}>
      <GoldFrame
        frame={isToday ? G.goldFrameToday : G.goldFrame}
        fill={isToday ? G.provToday : G.prov}
        fillColor="#20262e"
        shadow={isToday ? SH.provToday : SH.prov}
      >
        <View style={[s.head, isToday ? s.headToday : isPast ? s.headPast : s.headFut]}>
          <Shield index={p.index} today={isToday} past={isPast} />
          <View style={s.nameRow} accessibilityRole="header">
            <Text style={s.name}>{DAYS[p.index]} </Text>
            <Text style={s.ddate}>· {p.date.getDate()} {MONTHS[p.date.getMonth()]}</Text>
          </View>
          {total > 0 && (
            <View style={s.tally} accessible accessibilityLabel={`${doneN} / ${total} tamamlandı`}>
              <Text style={[s.tallyTxt, doneN === total && s.tallyAll]}>
                {doneN}/{total}
              </Text>
            </View>
          )}
          <MetalButton
            accessibilityRole="button"
            accessibilityLabel={`${dayLabel(p.date)} gününe görev ekle`}
            onPress={() => p.onAdd(p.ymd)}
            style={s.addBtn}
          >
            <PlusIcon />
          </MetalButton>
        </View>

        {isToday && p.lateCount > 0 && <AlertBar count={p.lateCount} onScreen={p.alertOnScreen} onPress={p.onShowLate} />}

        <View style={s.ledger}>
          {total === 0 ? (
            <View style={s.empty}>
              {!p.loading && (
                <>
                  <Flourish />
                  <Text style={s.emptyTxt}>Kayıtlı görev yok</Text>
                  <Flourish mirror />
                </>
              )}
            </View>
          ) : (
            p.tasks.map((t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                overdue={isOverdue(t, p.todayYmd)}
                last={i === total - 1}
                flashKey={p.flash && p.flash.id === t.id ? p.flash.key : undefined}
                onToggle={p.onToggle}
                onOpen={p.onOpen}
                onFail={p.onFail}
              />
            ))
          )}
        </View>
      </GoldFrame>
      {isToday && <Ribbon />}
    </Animated.View>
  );
}, sameProps);

/** "BUGÜN" ribbon with notched ends (clip-path polygon in the HTML). */
const Ribbon = memo(function Ribbon() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      pointerEvents="none"
      style={s.ribbon}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {size.w > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.w} height={size.h + 2}>
          <Defs>
            <LinearGradient id="ribbonG" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#fdf0bd" />
              <Stop offset="0.6" stopColor="#d9ad55" />
              <Stop offset="1" stopColor="#b78a36" />
            </LinearGradient>
          </Defs>
          {/* drop-shadow(0 2px 2px rgba(0,0,0,.6)) approximation */}
          <Polygon
            points={`0,2 ${size.w},2 ${size.w - 7},${size.h / 2 + 2} ${size.w},${size.h + 2} 0,${size.h + 2} 7,${size.h / 2 + 2}`}
            fill="#000"
            fillOpacity={0.45}
          />
          <Polygon
            points={`0,0 ${size.w},0 ${size.w - 7},${size.h / 2} ${size.w},${size.h} 0,${size.h} 7,${size.h / 2}`}
            fill="url(#ribbonG)"
          />
        </Svg>
      )}
      <Text style={s.ribbonTxt}>BUGÜN</Text>
    </View>
  );
});

/**
 * Overdue alert with a pulsing glow. The pulse is the app's only endless animation, so it
 * runs only while it can be seen: not with reduced motion, not in the background, and not
 * while scrolled out of view.
 */
const AlertBar = memo(function AlertBar({ count, onScreen, onPress }: { count: number; onScreen: boolean; onPress: () => void }) {
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const run = !reduced && appActive && onScreen;
  const glow = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      cancelAnimation(glow);
      glow.set(0); // also stops a pulse started before reduce-motion was turned on
      return;
    }
    if (!run) {
      cancelAnimation(glow);
      return;
    }
    glow.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, [reduced, run, glow]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={`${count} geciken görev. En son geciken görevi göster`}
      onPress={onPress}
      style={alertStyle}
    >
      <View style={s.alertIcon}>
        <Animated.View style={[s.alertGlow, glowStyle]} />
        <AlertIcon />
      </View>
      <Text style={s.alertTxt}>
        <Text style={s.alertB}>{count}</Text> geciken görev
      </Text>
      <Text style={s.alertGo}>Göster ›</Text>
    </Tappable>
  );
});

const s = StyleSheet.create({
  wrap: { position: 'relative', marginBottom: 16 },
  wrapToday: { marginTop: 24 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minHeight: 60,
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 6,
    backgroundColor: '#323b46',
    borderBottomWidth: 2,
    borderBottomColor: '#07080a',
    boxShadow: SH.provHead,
  },
  headToday: { backgroundImage: G.provHeadToday },
  headPast: { backgroundImage: G.provHeadPast },
  headFut: { backgroundImage: G.provHead },
  nameRow: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  name: { fontFamily: F.head700, fontSize: 17, lineHeight: 20.4, letterSpacing: 0.34, color: C.cream, ...TS },
  ddate: { fontFamily: F.sc500, fontSize: 16, lineHeight: 19.2, color: C.gold, ...TS },
  tally: {
    minWidth: 42,
    paddingVertical: 4,
    paddingHorizontal: 6,
    alignItems: 'center',
    backgroundColor: '#0c0f13',
    borderWidth: 1,
    borderColor: '#000',
    boxShadow: SH.tally,
  },
  tallyTxt: { fontFamily: F.sc700, fontSize: 14, lineHeight: 15, color: C.goldHi, textAlign: 'center' },
  tallyAll: { color: C.greenHi },
  addBtn: { width: 46, minHeight: 46 },
  ribbon: {
    position: 'absolute',
    zIndex: 3,
    top: -10,
    left: 53,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  ribbonTxt: { fontFamily: F.head700, fontSize: 12, lineHeight: 13, letterSpacing: 1.92, color: '#2a1d08' },
  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
    marginHorizontal: 6,
    minHeight: 46,
    paddingTop: 6,
    paddingBottom: 6,
    paddingLeft: 7,
    paddingRight: 10,
    backgroundColor: '#3a120d',
    backgroundImage: G.alert,
    borderWidth: 1,
    borderColor: '#ff8a72',
    borderRadius: 2,
    boxShadow: SH.alert,
  },
  alertDown: { transform: [{ translateY: 1 }] },
  alertIcon: { width: 30, height: 30 },
  alertGlow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    boxShadow: '0 0 8px 2px rgba(255,106,82,0.9)',
  },
  alertTxt: { flex: 1, fontFamily: F.body500, fontSize: 16, lineHeight: 19.2, color: '#ffe3d6' },
  alertB: { fontFamily: F.sc700, fontSize: 18, color: '#fff' },
  alertGo: { fontFamily: F.sc700, fontSize: 13, lineHeight: 14, letterSpacing: 0.52, color: '#ffb7a5' },
  ledger: {
    position: 'relative',
    margin: 6,
    backgroundColor: '#e9d7ac',
    backgroundImage: G.ledger,
    boxShadow: SH.ledger,
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emptyTxt: { fontFamily: F.body400i, fontSize: 15.5, lineHeight: 20, color: C.inkSoft, textAlign: 'center' },
});

const alertStyle = ({ pressed }: { pressed: boolean }) => [s.alert, pressed && s.alertDown];
