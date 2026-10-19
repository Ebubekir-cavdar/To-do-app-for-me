import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { addDays, dayIndex, dayLabel, DAYS, MONTHS, parseYmd, ymd } from '../lib/dates';
import { buildSeries, DEFAULT_SPAN_INDEX, EVERY_DAY, recurrenceDates, SPANS } from '../lib/recurrence';
import type { NewTask } from '../model/task';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { C, F, SH } from '../theme';
import { EvBody, EventModal, EvOpts, evText, useOpenKey } from './EventModal';
import { FermanScene } from './EventScene';
import { ChevronIcon, DecreeGlyph, NoGlyph } from './icons';
import { inp } from './inputStyles';
import { Chip } from './Chip';
import { MetalButton, OptionButton } from './primitives';
import { useSfx } from './Sfx';
import { resolveTime, TimeField } from './TimeField';

const SHORT_DAYS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'] as const;

/** `19 Ekim` (years added only when the range crosses a year). */
function shortDate(s: string, withYear: boolean): string {
  const d = parseYmd(s);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}

/** "9 görev eklenecek · 19 Ekim – 16 Kasım" — or null when no date matches. */
export function fermanPreview(dates: readonly string[]): string | null {
  if (!dates.length) return null;
  const first = dates[0];
  const last = dates[dates.length - 1];
  const crossYear = first.slice(0, 4) !== last.slice(0, 4);
  const range = first === last ? shortDate(first, false) : `${shortDate(first, crossYear)} – ${shortDate(last, crossYear)}`;
  return `${dates.length} görev eklenecek · ${range}`;
}

type InputRef = ComponentRef<typeof TextInput>;
type DeclareFn = (inputs: NewTask[], title: string) => void;

/** "Ferman Çıkar" event popup: add one task on chosen weekdays over a span (recurring add). */
export const FermanModal = memo(function FermanModal({
  visible,
  today,
  onClose,
  onDeclare,
}: {
  visible: boolean;
  today: string;
  onClose: () => void;
  onDeclare: DeclareFn;
}) {
  // Each opening gets a fresh form, starting today.
  const openKey = useOpenKey(visible);
  const titleRef = useRef<InputRef>(null);
  const focusTitle = useCallback(() => titleRef.current?.focus(), []);
  return (
    <EventModal visible={visible} onClose={onClose} title="Ferman Çıkar" onShow={focusTitle}>
      <FermanForm key={openKey} today={today} titleRef={titleRef} onClose={onClose} onDeclare={onDeclare} />
    </EventModal>
  );
});

function FermanForm({
  today,
  titleRef,
  onClose,
  onDeclare,
}: {
  today: string;
  titleRef: RefObject<InputRef | null>;
  onClose: () => void;
  onDeclare: DeclareFn;
}) {
  const reduced = useReducedMotion();
  const sfx = useSfx();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [titleErr, setTitleErr] = useState(false);
  const [timeErr, setTimeErr] = useState(false);
  const [titleFocus, setTitleFocus] = useState(false);
  const [pickedStart, setStart] = useState(today);
  // null until the user picks days: the selection then follows the start date's weekday.
  const [picked, setPicked] = useState<number[] | null>(null);
  const [spanIdx, setSpanIdx] = useState(DEFAULT_SPAN_INDEX);
  const timeRef = useRef<InputRef>(null);
  const shake = useSharedValue(0);

  useEffect(() => {
    // Autofocus; onShow also focuses (Android needs the window to be shown first).
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [titleRef]);

  // Never before today (also if the popup stays open past midnight).
  const start = pickedStart < today ? today : pickedStart;
  const startWeekday = dayIndex(parseYmd(start));
  const days = useMemo(() => picked ?? [startWeekday], [picked, startWeekday]);

  const stepStart = (delta: number) => {
    const next = ymd(addDays(parseYmd(start), delta));
    if (next >= today) setStart(next);
  };

  const toggleDay = (i: number) => {
    setPicked(days.includes(i) ? days.filter((d) => d !== i) : [...days, i].sort());
  };
  const allDays = days.length === EVERY_DAY.length;
  const toggleAll = () => setPicked(allDays ? [] : [...EVERY_DAY]);

  const span = SPANS[spanIdx].span;
  const dates = useMemo(() => recurrenceDates(start, span, days), [start, span, days]);
  const preview = fermanPreview(dates);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));
  const doShake = () => {
    if (reduced) return;
    shake.set(
      withSequence(
        withTiming(-6, { duration: 76 }),
        withTiming(6, { duration: 76 }),
        withTiming(-4, { duration: 76 }),
        withTiming(3, { duration: 76 }),
        withTiming(0, { duration: 76 }),
      ),
    );
  };

  const submit = () => {
    const t = title.trim();
    if (!t) {
      sfx.error();
      setTitleErr(true);
      doShake();
      titleRef.current?.focus();
      return;
    }
    const tm = resolveTime(time);
    if (tm === undefined) {
      sfx.error();
      setTimeErr(true);
      timeRef.current?.focus();
      return;
    }
    if (!dates.length) {
      sfx.error(); // only reachable via the keyboard's submit; the button is disabled
      return;
    }
    onDeclare(buildSeries({ title: t, time: tm, startYmd: start, span, weekdays: days }), t);
  };

  const atToday = start <= today;

  return (
    <>
      <FermanScene />
      <EvBody>
        <Text style={evText.flavor}>
          Divan kâtibi fermanı yazmaya hazır; hangi günlerde tekrar edileceğini bildirin.
        </Text>

        <Text style={[evText.label, s.firstLabel]} nativeID="lblFermanTitle">Görev adı</Text>
        <Animated.View style={shakeStyle}>
          <TextInput
            ref={titleRef}
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (v.trim()) setTitleErr(false);
            }}
            maxLength={200}
            placeholder="Örn. Spor salonu"
            placeholderTextColor="#9b8762"
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => timeRef.current?.focus()}
            onFocus={() => setTitleFocus(true)}
            onBlur={() => setTitleFocus(false)}
            autoCorrect
            autoCapitalize="sentences"
            accessibilityLabel="Görev adı"
            accessibilityLabelledBy="lblFermanTitle"
            style={[inp.base, titleFocus && inp.focus, titleErr && inp.err]}
          />
        </Animated.View>
        {titleErr && (
          <Text style={evText.hint} accessibilityLiveRegion="assertive">
            Lütfen bir görev adı yazın.
          </Text>
        )}

        <Text style={evText.label}>
          Saat <Text style={evText.labelSmall}>(isteğe bağlı)</Text>
        </Text>
        <TimeField
          ref={timeRef}
          value={time}
          onChange={(v) => {
            setTime(v);
            setTimeErr(false);
          }}
          onSubmit={submit}
          error={timeErr}
        />
        {timeErr && (
          <Text style={evText.hint} accessibilityLiveRegion="assertive">
            Saati SS:DD biçiminde yazın (örn. 09:30).
          </Text>
        )}

        <Text style={evText.label} nativeID="lblFermanDays">Günler</Text>
        <View style={s.dayRow} accessibilityLabel="Tekrar edilecek günler">
          {SHORT_DAYS.map((d, i) => (
            <Chip key={d} label={d} a11y={DAYS[i]} on={days.includes(i)} onPress={() => toggleDay(i)} style={s.dayChip} />
          ))}
        </View>
        <Chip label="Her gün" a11y="Her gün" on={allDays} onPress={toggleAll} style={s.allChip} />

        <Text style={evText.label}>Süre</Text>
        <View style={s.segRow} accessibilityRole="radiogroup" accessibilityLabel="Süre">
          {SPANS.map((sp, i) => (
            <Chip key={sp.label} label={sp.label} on={i === spanIdx} radio onPress={() => setSpanIdx(i)} style={s.seg} />
          ))}
        </View>

        <Text style={evText.label}>Başlangıç</Text>
        <View style={s.stepper}>
          <MetalButton
            accessibilityRole="button"
            accessibilityLabel="Önceki gün"
            accessibilityState={{ disabled: atToday }}
            disabled={atToday}
            onPress={() => stepStart(-1)}
            style={[s.stepBtn, atToday && s.stepOff]}
          >
            <ChevronIcon dir="left" size={18} />
          </MetalButton>
          <View style={s.stepFace} accessible accessibilityLabel={`Başlangıç: ${dayLabel(parseYmd(start))}`} accessibilityLiveRegion="polite">
            <Text style={s.stepTxt} numberOfLines={1} adjustsFontSizeToFit>{dayLabel(parseYmd(start))}</Text>
          </View>
          <MetalButton accessibilityRole="button" accessibilityLabel="Sonraki gün" onPress={() => stepStart(1)} style={s.stepBtn}>
            <ChevronIcon dir="right" size={18} />
          </MetalButton>
        </View>

        <View style={s.preview}>
          <Text style={preview ? s.previewTxt : [evText.hint, s.previewNone]} accessibilityLiveRegion="polite">
            {preview ?? 'Seçilen günlere bu sürede denk gelen gün yok'}
          </Text>
        </View>
      </EvBody>
      <EvOpts>
        <OptionButton
          kind="yes"
          icon={<DecreeGlyph />}
          label="Ferman İlan Et"
          sub={preview ? 'Mühürle ve deftere işle' : 'Önce en az bir gün seçin'}
          onPress={submit}
          sound={null}
          disabled={!preview}
        />
        <OptionButton kind="no" icon={<NoGlyph />} label="İptal" sub="Vazgeç, fermanı yırt" onPress={onClose} />
      </EvOpts>
    </>
  );
}

const s = StyleSheet.create({
  firstLabel: { marginTop: 4 },
  dayRow: { flexDirection: 'row', gap: 4 },
  dayChip: { flex: 1, minWidth: 0, paddingHorizontal: 0 },
  allChip: { alignSelf: 'flex-start', marginTop: 6, paddingHorizontal: 16 },
  segRow: { flexDirection: 'row', gap: 4 },
  seg: { flex: 1, minWidth: 0, paddingHorizontal: 2 },
  stepper: { flexDirection: 'row', alignItems: 'stretch', gap: 6 },
  stepBtn: { minHeight: 46, width: 46 },
  stepOff: { opacity: 0.4 },
  stepFace: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,250,232,0.62)',
    borderWidth: 1,
    borderColor: '#8a6f45',
    boxShadow: SH.inp,
  },
  stepTxt: { fontFamily: F.sc700, fontSize: 16, lineHeight: 20, color: C.ink },
  preview: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(106,82,51,0.35)',
  },
  previewTxt: { fontFamily: F.body700, fontSize: 15.5, lineHeight: 20, color: C.ink, textAlign: 'center' },
  previewNone: { marginTop: 0, textAlign: 'center' },
});
