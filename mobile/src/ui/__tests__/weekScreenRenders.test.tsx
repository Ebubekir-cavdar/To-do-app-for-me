/// <reference types="jest" />
/**
 * Render-count regression tests for the week screen on the local backend.
 *
 * Every probed component is wrapped (keeping its React.memo / compare) so each time its
 * function body actually runs is counted, per instance. The upper bounds below pin the
 * memoization work: e.g. toggling a task must re-render only that task's row and panel
 * (plus the counters), and a modal or a message-log line must not re-render the 7 panels.
 */
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useEffect, type ReactNode } from 'react';
import { GestureHandlerRootView, State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { backend } from '../../backend';
import { DataProvider } from '../../data/DataProvider';
import type { Task } from '../../model/task';
import { seedTasks } from '../../backend/localRepository';
import { LogProvider, useLog, type LogKind } from '../MessageLog';
import { SfxProvider } from '../Sfx';

type Counts = { renders: Record<string, number>; mounts: Record<string, number> };
const C: Counts = ((globalThis as { __renderProbe?: Counts }).__renderProbe ??= { renders: {}, mounts: {} });

/** Wraps a component so its body runs are counted under `name[:key]`, keeping memo + compare. */
function mockCounted(name: string, Comp: any, keyOf?: (p: any) => string) {
  const React = require('react');
  const probe = (globalThis as any).__renderProbe ??= { renders: {}, mounts: {} };
  const isMemo = Comp && Comp.$$typeof === Symbol.for('react.memo');
  const inner = isMemo ? Comp.type : Comp;
  function Counted(props: any) {
    const k = keyOf ? `${name}:${keyOf(props)}` : name;
    // Counting renders is the point of this probe: it must mutate during render.
    probe.renders[name] = (probe.renders[name] ?? 0) + 1; // eslint-disable-line react-hooks/immutability
    if (keyOf) probe.renders[k] = (probe.renders[k] ?? 0) + 1; // eslint-disable-line react-hooks/immutability
    React.useEffect(() => {
      probe.mounts[name] = (probe.mounts[name] ?? 0) + 1;
    }, []);
    return inner(props);
  }
  return isMemo ? React.memo(Counted, Comp.compare) : Counted;
}

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Minimal Reanimated stand-in (the official mock needs Reanimated's jest resolver).
jest.mock('react-native-reanimated', () => {
  const { View, ScrollView, Text } = require('react-native');
  const sv = (init: unknown) => {
    const t = { value: init };
    return { get value() { return t.value; }, set value(v) { t.value = v; }, get: () => t.value, set: (v: unknown) => { t.value = v; } };
  };
  const id = (x: unknown) => x;
  const easing: any = new Proxy({}, { get: () => (..._a: unknown[]) => id });
  return {
    __esModule: true,
    default: { View, ScrollView, Text, createAnimatedComponent: id },
    Easing: easing,
    useSharedValue: (init: unknown) => require('react').useState(() => sv(init))[0],
    useAnimatedStyle: () => ({}),
    withTiming: (v: unknown) => v,
    withDelay: (_d: number, v: unknown) => v,
    withRepeat: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
    cancelAnimation: () => {},
    // Used by react-native-gesture-handler when Reanimated is present.
    isSharedValue: () => false,
    useEvent: () => () => {},
    useHandler: () => ({ context: {}, doDependenciesDiffer: false, useWeb: false }),
    useComposedEventHandler: () => () => {},
    setGestureState: () => {},
  };
});
// The week screen's swipe worklets hop to JS with scheduleOnRN (the real module needs native).
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
// react-native-gesture-handler/jestSetup (its native module and host components).
jest.mock('react-native-gesture-handler/lib/module/RNGestureHandlerModule', () =>
  require('react-native-gesture-handler/lib/module/mocks/module'),
);
jest.mock('react-native-gesture-handler/lib/module/components/GestureComponents', () =>
  require('react-native-gesture-handler/lib/module/mocks/gestureComponents'),
);
jest.mock('react-native-gesture-handler/lib/module/v3/detectors/HostGestureDetector', () =>
  require('react-native-gesture-handler/lib/module/mocks/hostDetector'),
);
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-audio', () => {
  const mk = () => ({ volume: 1, seekTo: jest.fn(() => Promise.resolve()), play: jest.fn(), remove: jest.fn(), release: jest.fn() });
  return {
    // Like the real hook: one player per mounted hook, stable across renders.
    useAudioPlayer: jest.fn(() => require('react').useState(mk)[0]),
    createAudioPlayer: jest.fn(() => mk()),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: jest.fn(() => Promise.resolve()),
}));
const mockNotif = {
  permission: 'unsupported' as const,
  settings: { daily: true, reminders: true },
  setSettings() {},
  requestPermission: () => Promise.resolve(false),
  shouldAskPermission: false,
  markAsked() {},
  sendTestReminder: () => Promise.resolve(),
};
jest.mock('../../notifications', () => ({
  NotificationsProvider: ({ children }: { children: unknown }) => children,
  useNotifications: () => mockNotif,
  useNotificationOpen: () => {},
}));
jest.mock('../DayPanel', () => {
  const a = jest.requireActual('../DayPanel');
  return { ...a, DayPanel: mockCounted('DayPanel', a.DayPanel, (p) => String(p.index)) };
});
jest.mock('../TaskRow', () => {
  const a = jest.requireActual('../TaskRow');
  return { ...a, TaskRow: mockCounted('TaskRow', a.TaskRow, (p) => p.task.title) };
});
jest.mock('../TopBar', () => {
  const a = jest.requireActual('../TopBar');
  return { ...a, TopBar: mockCounted('TopBar', a.TopBar) };
});
jest.mock('../Shield', () => {
  const a = jest.requireActual('../Shield');
  return { ...a, Shield: mockCounted('Shield', a.Shield, (p) => String(p.index)) };
});
jest.mock('../AddTaskModal', () => {
  const a = jest.requireActual('../AddTaskModal');
  return { ...a, AddTaskModal: mockCounted('AddTaskModal', a.AddTaskModal) };
});
jest.mock('../FermanModal', () => {
  const a = jest.requireActual('../FermanModal');
  return { ...a, FermanModal: mockCounted('FermanModal', a.FermanModal) };
});
jest.mock('../../app/index', () => {
  const a = jest.requireActual('../../app/index');
  return { __esModule: true, ...a, default: mockCounted('WeekScreen', a.default) };
});

// eslint-disable-next-line import/first
import WeekScreen from '../../app/index';

/** Wednesday 14 Oct 2026, 10:00 — the seed data (designs/final.html) is relative to it. */
const NOW = new Date(2026, 9, 14, 10, 0);

let log: (text: string, kind: LogKind) => void = () => {};
function GrabLog() {
  const l = useLog();
  useEffect(() => { log = l; }, [l]);
  return null;
}

function App({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SfxProvider>
          <DataProvider>
            <LogProvider>
              <GrabLog />
              {children}
            </LogProvider>
          </DataProvider>
        </SfxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const reset = () => {
  for (const k of Object.keys(C.renders)) delete C.renders[k];
  for (const k of Object.keys(C.mounts)) delete C.mounts[k];
};
const snap = () => ({ renders: { ...C.renders }, mounts: { ...C.mounts } });
/** Let the store, effects, animations and timers settle. */
const settle = (ms = 50) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
const panels = (r: Record<string, number>) => [0, 1, 2, 3, 4, 5, 6].filter((i) => (r[`DayPanel:${i}`] ?? 0) > 0).length;

/**
 * Upper bounds after the memoization work. Before it: toggle re-rendered all 7 panels, adding a
 * task 7 panels twice (14), a modal re-rendered the top bar and every popup, and a week switch
 * re-created all 7 panels and shields.
 */
const BOUND = {
  initial: { WeekScreen: 3, TopBar: 2, DayPanel: 3, TaskRow: 1 },
  toggle: { WeekScreen: 1 },
  modal: { WeekScreen: 2 },
  add: { DayPanel: 2, TaskRow: 3 }, // the new row + its flash; the old last row loses its separator
  week: { TopBar: 1, DayPanel: 1 },
};

const report: Record<string, ReturnType<typeof snap>> = {};

beforeAll(() => { jest.useFakeTimers({ now: NOW }); });
beforeEach(async () => {
  // Fresh seed data for every scenario (the local repository is a module singleton that
  // reloads nothing, so write through it: clear, then let mount() seed it again).
  await AsyncStorage.setItem('todoapp.tasks.v1', JSON.stringify(seedTasks(NOW)));
});
afterAll(() => {
  jest.useRealTimers();
  const out = process.env.RENDER_REPORT;
  if (out) require('fs').writeFileSync(out, JSON.stringify(report, null, 2));
});

/** Mounts the week screen, waits for the first snapshot and the enter animations, then zeroes the counters. */
async function mount() {
  reset();
  await render(<App><WeekScreen /></App>);
  await settle(1000);
  expect(screen.getByText('Çamaşırları yıka')).toBeTruthy();
  const s = snap();
  reset();
  return s;
}

describe('week screen render counts (local backend)', () => {
  it('initial load', async () => {
    const s = (report.initialLoad = await mount());
    expect(s.mounts.DayPanel).toBe(7);
    expect(s.renders.WeekScreen).toBeLessThanOrEqual(BOUND.initial.WeekScreen);
    expect(s.renders.TopBar).toBeLessThanOrEqual(BOUND.initial.TopBar);
    for (let i = 0; i < 7; i++) expect(s.renders[`DayPanel:${i}`]).toBeLessThanOrEqual(BOUND.initial.DayPanel);
    expect(s.renders['TaskRow:Spor salonu']).toBeLessThanOrEqual(BOUND.initial.TaskRow);
    expect(s.renders.Shield).toBeLessThanOrEqual(7);
  });

  it('toggling one task re-renders only its row, its panel and the counters', async () => {
    await mount();
    await fireEvent.press(screen.getByLabelText('Çamaşırları yıka — tamamlandı'));
    await settle(600);
    const s = (report.toggle = snap());
    expect(s.renders['TaskRow:Çamaşırları yıka']).toBe(1);
    expect(s.renders.TaskRow).toBe(1);
    expect(s.renders['DayPanel:4']).toBe(1);
    expect(panels(s.renders)).toBe(1);
    expect(s.renders.TopBar).toBe(1);
    expect(s.renders.WeekScreen).toBeLessThanOrEqual(BOUND.toggle.WeekScreen);
    expect(s.renders.Shield ?? 0).toBe(0);
    expect(s.renders.AddTaskModal ?? 0).toBe(0);
    expect(s.renders.FermanModal ?? 0).toBe(0);
  });

  it('ticking strikes the title through, and unticking removes it', async () => {
    await mount();
    const struck = () => StyleSheet.flatten(screen.getByText('Çamaşırları yıka').props.style).textDecorationLine;
    // The seed has it done: untick, then tick again.
    expect(struck()).toBe('line-through');
    await fireEvent.press(screen.getByLabelText('Çamaşırları yıka — tamamlandı'));
    expect(struck()).toBeUndefined();
    await settle(600);
    expect(struck()).toBeUndefined();
    await fireEvent.press(screen.getByLabelText('Çamaşırları yıka — tamamlandı'));
    expect(struck()).toBe('line-through');
    await settle(600);
    expect(struck()).toBe('line-through');
  });

  it('a message-log line appearing and fading re-renders nothing on the week screen', async () => {
    await mount();
    await act(async () => { log('Yeni görev eklendi: deneme', 'add'); });
    await settle(5000);
    const s = (report.logLine = snap());
    expect(s.renders.WeekScreen ?? 0).toBe(0);
    expect(panels(s.renders)).toBe(0);
    expect(s.renders.TopBar ?? 0).toBe(0);
  });

  it('opening and closing a modal re-renders no panel, row or top bar', async () => {
    await mount();
    await fireEvent.press(screen.getByLabelText('Ferman çıkar'));
    await settle(400);
    expect(screen.getByText('Ferman Çıkar')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('İptal. Vazgeç, fermanı yırt'));
    await settle(400);
    expect(screen.queryByText('Ferman Çıkar')).toBeNull();
    const s = (report.modalOpenClose = snap());
    expect(panels(s.renders)).toBe(0);
    expect(s.renders.TaskRow ?? 0).toBe(0);
    expect(s.renders.TopBar ?? 0).toBe(0);
    expect(s.renders.AddTaskModal ?? 0).toBe(0);
    expect(s.renders.WeekScreen).toBeLessThanOrEqual(BOUND.modal.WeekScreen);
    expect(s.renders.Shield ?? 0).toBe(0);
  });

  it('adding one task re-renders only its panel (plus the new row and counters)', async () => {
    await mount();
    await fireEvent.press(screen.getAllByLabelText(/gününe görev ekle$/)[3]);
    await settle(400);
    await fireEvent.changeText(screen.getByLabelText('Görev başlığı'), 'Yeni iş');
    report.addOpenType = snap();
    reset();
    await fireEvent.press(screen.getByLabelText('Ekle. Kaydı deftere işle'));
    await settle(2000);
    expect(screen.getByText('Yeni iş')).toBeTruthy();
    const s = (report.addTask = snap());
    expect(panels(s.renders)).toBe(1);
    expect(s.renders['DayPanel:3']).toBeLessThanOrEqual(BOUND.add.DayPanel);
    expect(s.renders.TaskRow).toBeLessThanOrEqual(BOUND.add.TaskRow);
    expect(s.renders.TopBar).toBeLessThanOrEqual(1);
    expect(s.renders.Shield ?? 0).toBe(0);
    expect(s.renders.FermanModal ?? 0).toBe(0);
  });

  it('switching week keeps the panels and their unchanged shields', async () => {
    await mount();
    await fireEvent.press(screen.getByLabelText('Sonraki hafta'));
    await settle(1000);
    expect(screen.queryByText('BUGÜN')).toBeNull();
    const s = (report.weekSwitch = snap());
    expect(s.mounts.DayPanel ?? 0).toBe(0);
    expect(s.mounts.Shield ?? 0).toBe(0);
    // Only Wednesday's shield changes (today's crown → plain, past → future for Mon/Tue).
    expect(s.renders.Shield).toBeLessThanOrEqual(3);
    expect(s.renders.TaskRow ?? 0).toBe(0); // next week has no tasks: no rows to render
    expect(s.renders.TopBar).toBeLessThanOrEqual(BOUND.week.TopBar);
    for (let i = 0; i < 7; i++) expect(s.renders[`DayPanel:${i}`]).toBeLessThanOrEqual(BOUND.week.DayPanel);

    reset();
    await fireEvent.press(screen.getByLabelText('Önceki hafta'));
    await settle(1000);
    const back = (report.weekSwitchBack = snap());
    expect(back.mounts.DayPanel ?? 0).toBe(0);
    expect(back.mounts.Shield ?? 0).toBe(0);
    expect(screen.getByText('BUGÜN')).toBeTruthy();
    expect(screen.getByText('Çamaşırları yıka')).toBeTruthy();
  });
});

/** A horizontal pan on the week (the swipe callbacks are worklets; under jest they run on JS). */
async function swipe(dx: number, end: State = State.END) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('week-swipe'), [
      { state: State.BEGAN, translationX: 0 },
      { state: State.ACTIVE, translationX: Math.sign(dx) * 20 },
      { state: State.ACTIVE, translationX: dx },
      { state: end, translationX: dx },
    ]);
  });
  await settle(1000);
}

describe('week swipe (local backend)', () => {
  it('a short swipe snaps back: same week, nothing re-renders', async () => {
    await mount();
    await swipe(-60); // under SWIPE_COMMIT (70)
    const s = snap();
    expect(screen.getByText('BUGÜN')).toBeTruthy();
    expect(screen.getByText('Çamaşırları yıka')).toBeTruthy();
    expect(s.renders.WeekScreen ?? 0).toBe(0);
    expect(panels(s.renders)).toBe(0);
    expect(s.renders.TopBar ?? 0).toBe(0);
  });

  it('a long swipe switches week, and back', async () => {
    await mount();
    await swipe(-120); // finger to the left: next week
    expect(screen.queryByText('BUGÜN')).toBeNull();
    const s = snap();
    expect(s.mounts.DayPanel ?? 0).toBe(0);
    for (let i = 0; i < 7; i++) expect(s.renders[`DayPanel:${i}`] ?? 0).toBeLessThanOrEqual(BOUND.week.DayPanel);

    await swipe(120); // and back
    expect(screen.getByText('BUGÜN')).toBeTruthy();
    expect(screen.getByText('Çamaşırları yıka')).toBeTruthy();
  });

  it('a cancelled swipe never switches week', async () => {
    await mount();
    await swipe(-120, State.CANCELLED);
    expect(screen.getByText('BUGÜN')).toBeTruthy();
    expect(screen.getByText('Çamaşırları yıka')).toBeTruthy();
  });
});

describe('failed tasks: long-press (local backend)', () => {
  const audio = () => jest.requireMock('expo-audio') as { useAudioPlayer: jest.Mock };
  const haptics = () => jest.requireMock('expo-haptics') as { impactAsync: jest.Mock };
  let players = new Set<{ play: jest.Mock }>();
  /** Total plays across every sound player: one action must play exactly one sound. */
  const plays = () => {
    let n = 0;
    for (const p of players) n += p.play.mock.calls.length;
    return n;
  };
  const row = (title: string) => screen.getByLabelText(new RegExp(`^${title}(,|$)`));
  const box = (title: string) => screen.getByLabelText(`${title} — tamamlandı`);
  const counter = (prefix: string) => {
    const label = screen.getByLabelText(new RegExp(`^${prefix}`)).props.accessibilityLabel as string;
    return Number(label.slice(label.lastIndexOf(' ') + 1));
  };

  async function mountQuiet() {
    jest.clearAllMocks();
    await mount();
    // Let the deferred sound players load, then count from zero.
    await settle(3000);
    players = new Set(audio().useAudioPlayer.mock.results.map((r) => r.value));
    expect(players.size).toBe(8); // one per sound (fail has its own slot)
    jest.clearAllMocks();
    reset();
  }

  // The local repository is a module singleton: put the touched tasks back as seeded.
  afterEach(async () => {
    const repo = backend.repository({ uid: 'local', name: null, email: null, photoURL: null });
    const seed = seedTasks(NOW);
    let all: Task[] = [];
    repo.subscribeRange('2000-01-01', '2100-12-31', (t) => { all = t; })();
    await act(async () => {
      for (const t of all) {
        const s = seed.find((x) => x.title === t.title);
        if (t.failed) await repo.setFailed(t.id, false);
        if (s && t.done !== s.done) await repo.setDone(t.id, s.done);
      }
    });
  });

  it('long-press on an overdue task fails it: one fail sound + medium haptic, a log line, no tap, no modal', async () => {
    await mountQuiet();
    expect(row('Annemi ara').props.accessibilityLabel).toBe('Annemi ara, 19:30, gecikti');
    expect(screen.getByLabelText(/geciken görev\. En son/)).toBeTruthy();
    const late = counter('Tüm geciken görevler');
    const open = counter('Bu hafta açık görevler');

    await fireEvent(row('Annemi ara'), 'longPress');
    // Instant (optimistic), before any timer runs.
    expect(row('Annemi ara').props.accessibilityLabel).toBe('Annemi ara, 19:30, başarısız');
    expect(screen.getByText('Başarısız')).toBeTruthy();
    await settle(600);

    expect(plays()).toBe(1);
    expect(haptics().impactAsync).toHaveBeenCalledTimes(1);
    expect(haptics().impactAsync).toHaveBeenCalledWith('medium');
    expect(screen.getByText('Görev başarısız: Annemi ara')).toBeTruthy();
    expect(screen.queryByText('Görevi Sil')).toBeNull();
    expect(counter('Tüm geciken görevler')).toBe(late - 1);
    expect(counter('Bu hafta açık görevler')).toBe(open - 1);
    // Struck through in dark red, not done.
    const title = StyleSheet.flatten(screen.getByText('Annemi ara').props.style);
    expect(title.textDecorationLine).toBe('line-through');
    expect(box('Annemi ara').props.accessibilityState?.checked ?? box('Annemi ara').props['aria-checked']).toBe(false);

    // Only that row and its panel (Tuesday) re-render, plus today's (its overdue alert count) and the counters.
    const s = snap();
    expect(s.renders['TaskRow:Annemi ara']).toBeGreaterThanOrEqual(1);
    expect(s.renders.TaskRow).toBe(s.renders['TaskRow:Annemi ara']);
    expect(s.renders['DayPanel:1']).toBeGreaterThanOrEqual(1);
    expect([0, 3, 4, 5, 6].map((i) => s.renders[`DayPanel:${i}`] ?? 0)).toEqual([0, 0, 0, 0, 0]);
    // Today's alert bar counts one overdue task fewer (the seed has another one in the previous week).
    expect(screen.getByLabelText(/geciken görev\. En son/).props.accessibilityLabel).toMatch(new RegExp(`^${late - 1} geciken`));
  });

  /** A real touch through Pressability: grant, hold `ms`, release (not RNTL's longPress shortcut). */
  async function hold(el: { props: Record<string, (e: unknown) => void> }, ms: number) {
    const touch = { identifier: 0, locationX: 5, locationY: 5, pageX: 5, pageY: 5, target: 1, timestamp: Date.now(), touches: [], changedTouches: [] };
    const evt = () => ({ nativeEvent: { ...touch, timestamp: Date.now() }, currentTarget: { measure: () => {} }, persist: () => {} });
    await act(async () => { el.props.onResponderGrant(evt()); });
    await settle(ms);
    await act(async () => { el.props.onResponderRelease(evt()); });
    await settle(600);
  }

  it('a real 450 ms hold fires the long-press only — never the tap; a short press still taps', async () => {
    await mountQuiet();
    await hold(row('Market alışverişi'), 500);
    expect(row('Market alışverişi').props.accessibilityLabel).toBe('Market alışverişi, başarısız');
    expect(screen.queryByText('Görevi Sil')).toBeNull(); // the title's tap (delete modal) did not fire
    expect(plays()).toBe(1); // the fail sound only, no tap sound

    await hold(box('Market alışverişi'), 500); // checkbox hold: un-fail, not a toggle
    expect(row('Market alışverişi').props.accessibilityLabel).toBe('Market alışverişi');
    expect(screen.queryByText('Görev tamamlandı: Market alışverişi')).toBeNull();
    expect(plays()).toBe(2);

    await hold(row('Market alışverişi'), 100); // a short press is a normal tap: opens the delete modal
    expect(screen.getByText('Görevi Sil')).toBeTruthy();
    expect(row('Market alışverişi').props.accessibilityLabel).toBe('Market alışverişi');
  });

  it('long-press on a failed task un-fails it (undo sound, log), back to overdue', async () => {
    await mountQuiet();
    await fireEvent(row('Annemi ara'), 'longPress');
    await settle(600);
    jest.clearAllMocks();

    await fireEvent(box('Annemi ara'), 'longPress'); // the checkbox area works too
    expect(row('Annemi ara').props.accessibilityLabel).toBe('Annemi ara, 19:30, gecikti');
    await settle(600);
    expect(plays()).toBe(1);
    expect(haptics().impactAsync).not.toHaveBeenCalled();
    expect(screen.getByText('Başarısızlık geri alındı: Annemi ara')).toBeTruthy();
    expect(screen.queryByText('Başarısız')).toBeNull();
    expect(screen.queryByText('Görevi Sil')).toBeNull();
  });

  it('long-press on a done task does nothing', async () => {
    await mountQuiet();
    expect(row('Sabah yürüyüşü').props.accessibilityLabel).toBe('Sabah yürüyüşü, 07:30');
    await fireEvent(row('Sabah yürüyüşü'), 'longPress');
    await fireEvent(box('Sabah yürüyüşü'), 'longPress');
    await settle(600);
    expect(plays()).toBe(0);
    expect(haptics().impactAsync).not.toHaveBeenCalled();
    expect(row('Sabah yürüyüşü').props.accessibilityLabel).toBe('Sabah yürüyüşü, 07:30');
    expect(screen.queryByText('Başarısız')).toBeNull();
    expect(screen.queryByText('Görevi Sil')).toBeNull();
  });

  it('ticking a failed task marks it done and clears failed (the normal done sound and log)', async () => {
    await mountQuiet();
    await fireEvent(row('Spor salonu'), 'longPress'); // a future (today 18:00) task can fail too
    await settle(600);
    expect(row('Spor salonu').props.accessibilityLabel).toBe('Spor salonu, 18:00, başarısız');
    jest.clearAllMocks();

    await fireEvent.press(box('Spor salonu'));
    await settle(600);
    expect(row('Spor salonu').props.accessibilityLabel).toBe('Spor salonu, 18:00');
    expect(screen.getByText('Görev tamamlandı: Spor salonu')).toBeTruthy();
    expect(plays()).toBe(1);
    expect(haptics().impactAsync).toHaveBeenCalledWith('light');
    expect(screen.queryByText('Başarısız')).toBeNull();
  });

  it('offers the fail / un-fail accessibility action on the row (not on done rows)', async () => {
    await mountQuiet();
    expect(row('Market alışverişi').props.accessibilityActions).toEqual([{ name: 'fail', label: 'Başarısız olarak işaretle' }]);
    expect(row('Sabah yürüyüşü').props.accessibilityActions).toBeUndefined();
    await fireEvent(row('Market alışverişi'), 'accessibilityAction', { nativeEvent: { actionName: 'fail' } });
    await settle(600);
    expect(row('Market alışverişi').props.accessibilityLabel).toBe('Market alışverişi, başarısız');
    expect(row('Market alışverişi').props.accessibilityActions).toEqual([{ name: 'fail', label: 'Başarısızlığı geri al' }]);
    expect(screen.getByText('Görev başarısız: Market alışverişi')).toBeTruthy();
  });
});
