import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type AccessibilityActionEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { Task } from '../model/task';
import { C, EASE, F, G, SH } from '../theme';
import { FailIcon, LateIcon, RecurIcon, TickIcon } from './icons';
import { Tappable } from './primitives';

type Props = {
  task: Task;
  overdue: boolean;
  last: boolean;
  /** Changes (to a new number) whenever the row should flash. */
  flashKey?: number;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  /** Long-press on a not-done task: mark it failed, or un-fail it if it already is. */
  onFail: (t: Task) => void;
};

/** Hold time (ms) before a press on the row becomes a long-press (fail / un-fail). */
export const FAIL_LONG_PRESS_MS = 450;
const FAIL_ACTION = 'fail';

/**
 * One ledger line: bevelled checkbox, time column (+ ↻ for Ferman tasks), title (+ "Gecikti" or
 * "Başarısız" chip). A long-press anywhere on a not-done row toggles "failed" (and never also
 * fires the tap: Pressable cancels onPress once onLongPress has fired).
 */
export const TaskRow = memo(function TaskRow({ task, overdue, last, flashKey, onToggle, onOpen, onFail }: Props) {
  const reduced = useReducedMotion();
  const done = task.done;
  const failed = task.failed && !done;
  const late = overdue && !failed;

  // Tick: scale(.3) rotate(-12deg), opacity 0  →  none, opacity 1
  const tick = useSharedValue(done ? 1 : 0);
  const tickOp = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    const target = done ? 1 : 0;
    tick.set(withTiming(target, { duration: reduced ? 0 : 250, easing: Easing.bezier(...EASE.tick) }));
    tickOp.set(withTiming(target, { duration: reduced ? 0 : 150 }));
  }, [done, reduced, tick, tickOp]);
  const tickStyle = useAnimatedStyle(() => ({
    opacity: tickOp.get(),
    transform: [{ scale: 0.3 + 0.7 * tick.get() }, { rotate: `${-12 * (1 - tick.get())}deg` }],
  }));

  // Failed ✗: the same pop as the tick, turning the other way. Only mounted while failed.
  const cross = useSharedValue(failed ? 1 : 0);
  const crossOp = useSharedValue(failed ? 1 : 0);
  useEffect(() => {
    const target = failed ? 1 : 0;
    cross.set(withTiming(target, { duration: reduced ? 0 : 250, easing: Easing.bezier(...EASE.tick) }));
    crossOp.set(withTiming(target, { duration: reduced ? 0 : 150 }));
  }, [failed, reduced, cross, crossOp]);
  const crossStyle = useAnimatedStyle(() => ({
    opacity: crossOp.get(),
    transform: [{ scale: 0.3 + 0.7 * cross.get() }, { rotate: `${12 * (1 - cross.get())}deg` }],
  }));

  // Flash: rgba(246,227,161,.85) held for 30% of 1.3s, then fades out.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!flashKey) return;
    flash.set(0.85);
    // JS timer, not withDelay: Reanimated skips delays when the OS asks for reduced motion.
    const h = setTimeout(() => {
      flash.set(reduced ? 0 : withTiming(0, { duration: 910, easing: Easing.out(Easing.ease) }));
    }, reduced ? 600 : 390);
    return () => clearTimeout(h);
  }, [flashKey, reduced, flash]);
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));

  const recurring = task.recurrenceId != null;
  const label = `${task.title}${task.time ? ', ' + task.time : ''}${late ? ', gecikti' : ''}${failed ? ', başarısız' : ''}${recurring ? ', tekrarlayan görev' : ''}`;

  // Done tasks: a long-press is swallowed (no tap, no sound) and offers no action.
  const onLongPress = () => {
    if (!task.done) onFail(task);
  };
  const actions = done ? undefined : [{ name: FAIL_ACTION, label: failed ? 'Başarısızlığı geri al' : 'Başarısız olarak işaretle' }];
  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === FAIL_ACTION) onLongPress();
  };

  return (
    <View style={[s.task, !last && s.sep, late && s.late]}>
      <Animated.View pointerEvents="none" style={[s.flash, flashStyle]} />
      {/* No press sound: onToggle plays done / undo. */}
      <Tappable
        sound={null}
        role="checkbox"
        aria-checked={done}
        accessibilityLabel={`${task.title} — tamamlandı`}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}
        onPress={() => onToggle(task)}
        onLongPress={onLongPress}
        delayLongPress={FAIL_LONG_PRESS_MS}
        style={s.chk}
      >
        {({ pressed }) => (
          <View style={[s.box, done && s.boxDone, late && s.boxLate, failed && s.boxFailed, pressed && s.boxDown]}>
            <Animated.View style={tickStyle}>
              <TickIcon />
            </Animated.View>
            {failed ? (
              <Animated.View style={[s.cross, crossStyle]}>
                <FailIcon />
              </Animated.View>
            ) : null}
          </View>
        )}
      </Tappable>
      <Tappable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={recurring ? 'Tekrarlayan görev. Silme penceresini açar' : 'Silme penceresini açar'}
        accessibilityActions={actions}
        onAccessibilityAction={onAction}
        onPress={() => onOpen(task)}
        onLongPress={onLongPress}
        delayLongPress={FAIL_LONG_PRESS_MS}
        style={s.ttext}
      >
        {({ pressed }) => (
          <>
            <View style={s.ttime}>
              <Text
                style={[
                  s.ttimeTxt,
                  !task.time && s.ttimeNone,
                  done && s.doneText,
                  late && s.redInk,
                  failed && s.failedText,
                ]}
              >
                {task.time || '—'}
              </Text>
              {recurring ? (
                <View style={[s.recur, (done || failed) && s.recurDone]} accessibilityLabel="Tekrarlayan görev">
                  <RecurIcon color={late ? C.redInk : C.inkSoft} />
                </View>
              ) : null}
            </View>
            <View style={[s.titleWrap, pressed && s.titlePressed]}>
              <Text style={[s.title, done && s.titleDone, late && s.redInk]}>
                {/* Struck through on its own span, so the chip after it stays clean. */}
                {failed ? <Text style={s.titleFailed}>{task.title}</Text> : task.title}
                {late ? (
                  <View style={s.lateChip}>
                    <LateIcon />
                    <Text style={s.lateTxt}>Gecikti</Text>
                  </View>
                ) : null}
                {failed ? (
                  <View style={[s.lateChip, s.failChip]}>
                    <FailIcon size={10} />
                    <Text style={[s.lateTxt, s.failTxt]}>Başarısız</Text>
                  </View>
                ) : null}
              </Text>
            </View>
          </>
        )}
      </Tappable>
    </View>
  );
});

/** Dark blood-red strikethrough of a failed task's title and time. */
const FAIL_STRIKE = '#8a160b';

const s = StyleSheet.create({
  task: { position: 'relative', flexDirection: 'row', alignItems: 'stretch', minHeight: 50 },
  sep: { borderBottomWidth: 1, borderBottomColor: 'rgba(106,82,51,0.28)' },
  late: { backgroundImage: G.rowLate, boxShadow: SH.rowLate },
  flash: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgb(246,227,161)' },
  redInk: { color: C.redInk },
  chk: { width: 50, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  box: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#464f5a',
    backgroundImage: G.box,
    borderWidth: 1,
    borderColor: '#1a1206',
    boxShadow: SH.box,
  },
  boxDone: { backgroundColor: '#25481b', backgroundImage: G.boxDone },
  boxLate: { backgroundColor: '#64201a', backgroundImage: G.boxLate, boxShadow: SH.boxLate },
  boxFailed: { backgroundColor: '#1c0907', backgroundImage: G.boxFailed, boxShadow: SH.boxFailed },
  boxDown: { transform: [{ translateY: 1 }], boxShadow: SH.boxDown },
  cross: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ttext: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'stretch' },
  ttime: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: 'rgba(163,24,12,0.3)',
  },
  recur: { marginTop: 1, opacity: 0.75 },
  recurDone: { opacity: 0.45 },
  ttimeTxt: { fontFamily: F.sc700, fontSize: 15, lineHeight: 17, color: C.inkSoft },
  ttimeNone: { fontFamily: F.sc500, color: 'rgba(106,82,51,0.45)' },
  doneText: { color: C.inkDone, textDecorationLine: 'line-through' },
  failedText: { color: C.inkDone, textDecorationLine: 'line-through', textDecorationColor: FAIL_STRIKE },
  titleWrap: { flex: 1, minWidth: 0, justifyContent: 'center' },
  titlePressed: { backgroundColor: 'rgba(106,82,51,0.08)' },
  title: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 11,
    paddingRight: 12,
    fontFamily: F.body500,
    fontSize: 17,
    lineHeight: 21.8,
    color: C.ink,
  },
  titleDone: {
    color: C.inkDone,
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(58,40,20,0.8)',
  },
  titleFailed: { color: C.inkDone, textDecorationLine: 'line-through', textDecorationColor: FAIL_STRIKE },
  lateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginLeft: 6,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 4,
    paddingRight: 6,
    backgroundColor: '#b02c1b',
    backgroundImage: G.lateChip,
    borderWidth: 1,
    borderColor: '#4a0b05',
    transform: [{ translateY: -1 }],
  },
  lateTxt: { fontFamily: F.sc700, fontSize: 12, lineHeight: 13, letterSpacing: 0.6, color: '#fff', textDecorationLine: 'none' },
  failChip: { paddingLeft: 3, backgroundColor: '#140807', backgroundImage: G.failChip, borderColor: '#7a1a10' },
  failTxt: { color: '#e9917c' },
});
