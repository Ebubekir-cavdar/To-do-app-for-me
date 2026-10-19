import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { GestureDetector, ScrollView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { useOpenTasks, useTaskActions, useTasksInRange } from '../data/DataProvider';
import { addDays, dayIndex, fmtRange, mondayOf, parseYmd, weekDays, ymd } from '../lib/dates';
import { groupByDate, isOpen, isOverdue } from '../lib/tasks';
import type { NewTask, Task } from '../model/task';
import { useNotificationOpen } from '../notifications';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useToday } from '../hooks/useToday';
import { C, EASE, F, G, SH } from '../theme';
import { AccountModal } from '../ui/AccountModal';
import { AddTaskModal } from '../ui/AddTaskModal';
import { DayPanel } from '../ui/DayPanel';
import { DeleteModal } from '../ui/DeleteModal';
import { FermanModal } from '../ui/FermanModal';
import { NotifyAskModal } from '../ui/NotifyAskModal';
import { useLog } from '../ui/MessageLog';
import { useSounds } from '../ui/Sfx';
import { TopBar, type PipState } from '../ui/TopBar';

const SWIPE_COMMIT = 70;
/** scroll-margin-top in final.html (panel top lands 14px under the top bar). */
const SCROLL_MARGIN = 14;
/** .week padding-top; panel y is measured inside it. */
const WEEK_PAD_TOP = 16;
/** Where the overdue alert sits inside today's panel (below the 60px head), with slack. */
const ALERT_TOP = 40;
const ALERT_BOTTOM = 160;

type PendingScroll = { ymd: string; smooth: boolean; until: number; aligned?: boolean };
type Range = { from: string; to: string; tasks: Task[] };

export default function WeekScreen() {
  const today = useToday();
  const reduced = useReducedMotion();
  const log = useLog();
  const sfx = useSounds();
  const { add, addMany, setDone, setFailed, remove, removeSeries } = useTaskActions();

  /* ---------- week & data ---------- */
  const [monY, setMonY] = useState(() => ymd(mondayOf(new Date())));
  const weekStart = useMemo(() => parseYmd(monY), [monY]);
  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const sunY = ymd(days[6]);
  const currentMonY = useMemo(() => ymd(mondayOf(parseYmd(today))), [today]);
  const isCurrent = monY === currentMonY;

  // Subscribe to the neighbouring weeks too, so swiping shows data immediately.
  const fromY = ymd(addDays(weekStart, -7));
  const toY = ymd(addDays(weekStart, 13));
  const { tasks: wide, loading } = useTasksInRange(fromY, toY);
  // While a new range loads, the last loaded one may still cover the week we swiped to
  // (captured when switching, see switchTo).
  const [prevRange, setPrevRange] = useState<Range | null>(null);
  const source = !loading ? wide : prevRange && prevRange.from <= monY && prevRange.to >= sunY ? prevRange.tasks : null;
  const weekLoading = source === null;
  const weekTasks = useMemo(
    () => (source ? source.filter((t) => t.date >= monY && t.date <= sunY) : EMPTY),
    [source, monY, sunY],
  );
  // Task objects are stable across snapshots (data layer), and DayPanel compares its tasks
  // element-wise, so only the panel of a changed day re-renders.
  const groups = useMemo(() => groupByDate(weekTasks), [weekTasks]);

  const open = useOpenTasks();
  const late = useMemo(() => open.filter((t) => isOverdue(t, today)), [open, today]);

  const weekDone = useMemo(() => weekTasks.filter((t) => t.done).length, [weekTasks]);
  // "Açık": neither done nor failed (failed tasks still count in the total for the progress %).
  const weekOpen = useMemo(() => weekTasks.filter(isOpen).length, [weekTasks]);
  const weekTotal = weekTasks.length;
  const pct = weekTotal ? Math.round((weekDone * 100) / weekTotal) : 0;
  const pips = useMemo<PipState[]>(
    () => days.map((d) => { const s = ymd(d); return s < today ? 'past' : s === today ? 'now' : 'fut'; }),
    [days, today],
  );
  const rangeText = useMemo(() => fmtRange(days[0], days[6]), [days]);

  /* ---------- modal state ---------- */
  const [addDate, setAddDate] = useState<string | null>(null);
  const [delTask, setDelTask] = useState<Task | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [fermanOpen, setFermanOpen] = useState(false);

  // Latest committed values for the stable event handlers below.
  const latest = useRef({ monY, currentMonY, today, late, weekTasks, reduced, fromY, toY, wide, loading, isCurrent, addDate });
  useLayoutEffect(() => {
    latest.current = { monY, currentMonY, today, late, weekTasks, reduced, fromY, toY, wide, loading, isCurrent, addDate };
  });

  /* ---------- scrolling ---------- */
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  /** Panel y by weekday (Mon=0): the 7 panels are kept across weeks. */
  const panelY = useRef<(number | undefined)[]>([]);
  // Land on today when the first layout arrives (the 2.5s window starts at mount).
  const pending = useRef<PendingScroll | null>({ ymd: today, smooth: false, until: 0 });
  useLayoutEffect(() => {
    const p = pending.current;
    if (p && p.until === 0) p.until = Date.now() + 2500;
  }, []);

  const scrollToY = useCallback((y: number, animated: boolean) => {
    (scrollRef.current as unknown as { scrollTo?: (o: { y: number; animated: boolean }) => void })?.scrollTo?.({
      y: Math.max(0, y),
      animated,
    });
  }, []);

  /** `d` is a day of the shown week. */
  const scrollToDay = useCallback(
    (d: string, smooth: boolean) => {
      const y = panelY.current[dayIndex(parseYmd(d))];
      if (y === undefined) return false;
      scrollToY(y + WEEK_PAD_TOP - SCROLL_MARGIN, smooth && !latest.current.reduced);
      return true;
    },
    [scrollToY],
  );

  /* ---------- overdue-alert visibility: its pulse pauses while scrolled out of view ---------- */
  const scrollY = useRef(0);
  const viewportH = useRef(0);
  const [alertOnScreen, setAlertOnScreen] = useState(true);
  const alertShown = useRef(true);
  const updateAlertOnScreen = useCallback(() => {
    const l = latest.current;
    const y = panelY.current[dayIndex(parseYmd(l.today))];
    let seen = true;
    if (l.isCurrent && y !== undefined && viewportH.current > 0) {
      const top = y + WEEK_PAD_TOP + ALERT_TOP;
      const bottom = y + WEEK_PAD_TOP + ALERT_BOTTOM;
      seen = bottom > scrollY.current && top < scrollY.current + viewportH.current;
    }
    if (seen !== alertShown.current) {
      alertShown.current = seen;
      setAlertOnScreen(seen);
    }
  }, []);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.current = e.nativeEvent.contentOffset.y;
      updateAlertOnScreen();
    },
    [updateAlertOnScreen],
  );
  const onViewportLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewportH.current = e.nativeEvent.layout.height;
      updateAlertOnScreen();
    },
    [updateAlertOnScreen],
  );

  const onLayoutY = useCallback(
    (d: string, index: number, y: number) => {
      panelY.current[index] = y;
      if (d === latest.current.today) updateAlertOnScreen();
      const p = pending.current;
      if (!p || p.ymd !== d) return;
      if (Date.now() > p.until) { pending.current = null; return; }
      p.aligned = true;
      scrollToDay(d, p.smooth);
      // Keep re-aligning while earlier panels settle (data/fonts), like final.html.
      p.smooth = false;
    },
    [scrollToDay, updateAlertOnScreen],
  );

  // The 2.5s re-align window must cover the week's tasks arriving: the first snapshot can take
  // longer than that on a device (cold start / first sync), and loading grows earlier panels.
  useEffect(() => {
    const p = pending.current;
    if (p && !weekLoading) p.until = Math.max(p.until, Date.now() + 2500);
  }, [weekLoading]);

  // After a week switch the panels are reused: when the target panel's position didn't change,
  // no onLayout arrives. Give layout a frame, then scroll to its known position.
  useEffect(() => {
    const p = pending.current;
    if (!p || p.ymd < monY || p.ymd > sunY) return;
    const raf = requestAnimationFrame(() => {
      if (pending.current !== p || p.aligned) return;
      if (scrollToDay(p.ymd, p.smooth)) p.smooth = false;
    });
    return () => cancelAnimationFrame(raf);
  }, [monY, sunY, scrollToDay]);

  const userScrolled = useCallback(() => { pending.current = null; }, []);

  /* ---------- week switching + slide animation ---------- */
  const tx = useSharedValue(0);
  const op = useSharedValue(1);
  const slideStyle = useAnimatedStyle(() => ({ opacity: op.get(), transform: [{ translateX: tx.get() }] }));
  // The swipe worklets run on the UI thread, where `latest` can't be read.
  const reducedSV = useSharedValue(reduced);
  useEffect(() => { reducedSV.set(reduced); }, [reduced, reducedSV]);

  const switchTo = useCallback(
    (newMon: string, dir: number, scrollTarget: { ymd: string; smooth: boolean } | null) => {
      const l = latest.current;
      if (!l.loading) setPrevRange({ from: l.fromY, to: l.toY, tasks: l.wide });
      pending.current = scrollTarget ? { ...scrollTarget, until: Date.now() + 2500 } : null;
      setMonY(newMon);
      if (!scrollTarget) scrollToY(0, false);
      if (l.reduced) {
        tx.set(0);
        op.set(1);
      } else {
        tx.set(dir * 36);
        op.set(0);
        const cfg = { duration: 320, easing: Easing.bezier(...EASE.slide) };
        tx.set(withTiming(0, cfg));
        op.set(withTiming(1, cfg));
      }
    },
    [scrollToY, tx, op],
  );

  const go = useCallback(
    (delta: number) => {
      const l = latest.current;
      const next = ymd(addDays(parseYmd(l.monY), 7 * delta));
      switchTo(next, delta, next === l.currentMonY ? { ymd: l.today, smooth: false } : null);
    },
    [switchTo],
  );
  const goPrev = useCallback(() => go(-1), [go]);
  const goNext = useCallback(() => go(1), [go]);

  const goToday = useCallback(() => {
    const { monY: m, currentMonY: cur, today: t } = latest.current;
    if (m !== cur) switchTo(cur, cur > m ? 1 : -1, { ymd: t, smooth: false });
    else scrollToDay(t, true);
  }, [switchTo, scrollToDay]);

  // Tapping a notification lands on today.
  useNotificationOpen(goToday);

  /* ---------- swipe ---------- */
  // The swipe follows the finger on the UI thread (worklets); only the commit hops to JS.
  const commitSwipe = useCallback(
    (delta: number) => {
      // ‹ › and the plaque tap through their buttons; a swipe has no button.
      sfx.tap();
      go(delta);
    },
    [sfx, go],
  );
  // Stable config: RNGH re-sends a gesture's config to native whenever this object changes.
  const panConfig = useMemo(
    () => ({
      ...PAN_WEB,
      testID: 'week-swipe',
      activeOffsetX: [-15, 15] as [number, number],
      failOffsetY: [-12, 12] as [number, number],
      onUpdate: (e: { translationX: number }) => {
        'worklet';
        tx.set(e.translationX * 0.55);
        op.set(Math.max(0.45, 1 - Math.abs(e.translationX) / 600));
      },
      onDeactivate: (e: { translationX: number; canceled: boolean }) => {
        'worklet';
        if (!e.canceled && Math.abs(e.translationX) > SWIPE_COMMIT) {
          scheduleOnRN(commitSwipe, e.translationX < 0 ? 1 : -1);
        } else {
          const duration = reducedSV.get() ? 0 : 150;
          tx.set(withTiming(0, { duration }));
          op.set(withTiming(1, { duration }));
        }
      },
    }),
    [commitSwipe, tx, op, reducedSV],
  );
  const pan = usePanGesture(panConfig);

  /* ---------- flash rows ---------- */
  const [flash, setFlash] = useState<{ id: string; key: number } | null>(null);
  const flashRow = useCallback((id: string) => setFlash({ id, key: Date.now() }), []);
  // Only the panel holding the flashed row receives the flash.
  const flashDate = useMemo(
    () => (flash ? (weekTasks.find((t) => t.id === flash.id)?.date ?? null) : null),
    [flash, weekTasks],
  );

  // A newly added task: flash it once it shows up (add() doesn't return the id).
  const newTask = useRef<{ date: string; title: string; before: Set<string> } | null>(null);
  useEffect(() => {
    const n = newTask.current;
    if (!n) return;
    const hit = weekTasks.find((t) => t.date === n.date && t.title === n.title && !n.before.has(t.id));
    if (hit) {
      newTask.current = null;
      flashRow(hit.id);
    }
  }, [weekTasks, flashRow]);

  const showLatest = useCallback(() => {
    const { late: lt, monY: m } = latest.current;
    if (!lt.length) return;
    const t = lt.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))[0];
    const wk = ymd(mondayOf(parseYmd(t.date)));
    if (wk !== m) switchTo(wk, -1, { ymd: t.date, smooth: false });
    else if (!scrollToDay(t.date, true)) pending.current = { ymd: t.date, smooth: true, until: Date.now() + 2500 };
    flashRow(t.id);
  }, [switchTo, scrollToDay, flashRow]);

  /* ---------- actions & modals ---------- */
  const onToggle = useCallback(
    (t: Task) => {
      const done = !t.done;
      setDone(t.id, done);
      log((done ? 'Görev tamamlandı: ' : 'Görev geri alındı: ') + t.title, done ? 'done' : 'undo');
      if (done) sfx.done();
      else sfx.undo();
    },
    [setDone, log, sfx],
  );

  /** Long-press: fail a not-done task, or un-fail a failed one. Done tasks are left alone. */
  const onFail = useCallback(
    (t: Task) => {
      if (t.done) return;
      if (t.failed) {
        setFailed(t.id, false);
        log('Başarısızlık geri alındı: ' + t.title, 'undo');
        sfx.undo();
      } else {
        setFailed(t.id, true);
        log('Görev başarısız: ' + t.title, 'fail');
        sfx.fail(); // also the medium haptic
      }
    },
    [setFailed, log, sfx],
  );

  const onAdd = useCallback(
    (title: string, time: string | null) => {
      const { addDate: date, weekTasks: wt } = latest.current;
      if (!date) return;
      newTask.current = { date, title, before: new Set(wt.map((t) => t.id)) };
      add({ title, date, time });
      setAddDate(null);
      log('Yeni görev eklendi: ' + title, 'add');
    },
    [add, log],
  );

  const onDelete = useCallback(
    (t: Task) => {
      remove(t.id);
      setDelTask(null);
      log('Görev silindi: ' + t.title, 'del');
    },
    [remove, log],
  );

  const onDeleteSeries = useCallback(
    (t: Task) => {
      if (!t.recurrenceId) return;
      removeSeries(t.recurrenceId, t.date);
      setDelTask(null);
      log('Ferman kaldırıldı: ' + t.title + ' (bu ve sonrakiler)', 'del');
    },
    [removeSeries, log],
  );

  const onDeclare = useCallback(
    (inputs: NewTask[], title: string) => {
      if (!inputs.length) return;
      addMany(inputs);
      sfx.ferman();
      setFermanOpen(false);
      log(`Ferman ilan edildi: ${title} — ${inputs.length} görev`, 'ferman');
    },
    [addMany, log, sfx],
  );

  const onOpenAdd = useCallback((d: string) => setAddDate(d), []);
  const onOpenTask = useCallback((t: Task) => setDelTask(t), []);
  const closeAdd = useCallback(() => setAddDate(null), []);
  const closeDelete = useCallback(() => setDelTask(null), []);
  const openFerman = useCallback(() => setFermanOpen(true), []);
  const closeFerman = useCallback(() => setFermanOpen(false), []);
  const openAccount = useCallback(() => setAccountOpen(true), []);
  const closeAccount = useCallback(() => setAccountOpen(false), []);

  return (
    <View style={s.page}>
      <View style={s.app}>
        <TopBar
          done={weekDone}
          open={weekOpen}
          late={late.length}
          pct={pct}
          range={rangeText}
          pips={pips}
          isCurrent={isCurrent}
          onPrev={goPrev}
          onNext={goNext}
          onToday={goToday}
          onFerman={openFerman}
          onAccount={openAccount}
        />
        <ScrollView
          ref={scrollRef}
          style={s.scroll}
          onLayout={onViewportLayout}
          onScroll={onScroll}
          scrollEventThrottle={100}
          onScrollBeginDrag={userScrolled}
          onMomentumScrollBegin={userScrolled}
          accessibilityLabel="Haftanın günleri"
        >
          <GestureDetector gesture={pan}>
            <Animated.View style={[s.week, slideStyle]}>
              <View>
                {days.map((d, i) => {
                  const dy = ymd(d);
                  const isToday = dy === today;
                  // Keyed by weekday: a week switch updates the 7 panels instead of re-creating them.
                  return (
                    <DayPanel
                      key={i}
                      date={d}
                      ymd={dy}
                      index={i}
                      todayYmd={today}
                      tasks={groups[dy] || EMPTY}
                      loading={weekLoading}
                      lateCount={isCurrent && isToday ? late.length : 0}
                      alertOnScreen={isToday ? alertOnScreen : true}
                      flash={flashDate === dy ? flash : null}
                      onAdd={onOpenAdd}
                      onToggle={onToggle}
                      onOpen={onOpenTask}
                      onFail={onFail}
                      onShowLate={showLatest}
                      onLayoutY={onLayoutY}
                    />
                  );
                })}
              </View>
              <Text style={s.colophon}>— Görev Defteri —</Text>
            </Animated.View>
          </GestureDetector>
        </ScrollView>
      </View>

      <AddTaskModal date={addDate} onClose={closeAdd} onAdd={onAdd} />
      <DeleteModal task={delTask} onClose={closeDelete} onDelete={onDelete} onDeleteSeries={onDeleteSeries} />
      <FermanModal visible={fermanOpen} today={today} onClose={closeFerman} onDeclare={onDeclare} />
      <AccountModal visible={accountOpen} onClose={closeAccount} />
      <NotifyAskModal blocked={addDate !== null || delTask !== null || accountOpen || fermanOpen} />
    </View>
  );
}

const EMPTY: Task[] = [];

/**
 * Web: let the browser keep vertical touch scrolling (final.html: touch-action: pan-y).
 * Passed in the gesture config (whitelisted by RNGH) because a detector-level prop is
 * dropped whenever the handler config is refreshed; RNGH's public type omits it.
 */
const PAN_WEB = { touchAction: 'pan-y' } as object;

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.page, backgroundImage: G.page },
  app: {
    flex: 1,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    backgroundColor: '#181c22',
    backgroundImage: G.app,
    boxShadow: SH.app,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  week: { paddingTop: WEEK_PAD_TOP, paddingHorizontal: 10, paddingBottom: 96 },
  colophon: {
    textAlign: 'center',
    fontFamily: F.head500,
    fontSize: 13,
    lineHeight: 18.2,
    letterSpacing: 1.82,
    color: '#6d7884',
    marginTop: 8,
  },
});
