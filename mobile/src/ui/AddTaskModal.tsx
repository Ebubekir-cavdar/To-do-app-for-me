import { memo, useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Text, TextInput } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { dayLabel, parseYmd } from '../lib/dates';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { EvBody, EventModal, EvOpts, evText, useLatest, useOpenKey } from './EventModal';
import { EventScene } from './EventScene';
import { NoGlyph, YesGlyph } from './icons';
import { inp } from './inputStyles';
import { OptionButton } from './primitives';
import { useSfx } from './Sfx';
import { resolveTime, TimeField } from './TimeField';

const FLAVORS = [
  'Saray kâtibi divit hokkasını açtı; yeni bir kaydı deftere işlemek için emrinizi bekliyor.',
  'Danışmanlarınız divanda toplandı. Hükümdarın gündemine yeni bir mesele eklenecek.',
  'Ulaklar kapıda bekliyor. Yerine getirilecek işi bildirin, kayda geçsin.',
];
/** A random flavour line, picked once per opening (lazy state initializer). */
const pickFlavor = () => FLAVORS[Math.floor(Math.random() * FLAVORS.length)];

type InputRef = ComponentRef<typeof TextInput>;

/** "Yeni Görev" event popup. Visible while `date` is non-null. */
export const AddTaskModal = memo(function AddTaskModal({
  date,
  onClose,
  onAdd,
}: {
  date: string | null;
  onClose: () => void;
  onAdd: (title: string, time: string | null) => void;
}) {
  const shownDate = useLatest(date);
  // Each opening gets a fresh form (title, time, errors, flavour).
  const openKey = useOpenKey(date);
  const titleRef = useRef<InputRef>(null);
  const focusTitle = useCallback(() => titleRef.current?.focus(), []);
  return (
    <EventModal visible={date !== null} onClose={onClose} title="Yeni Görev" onShow={focusTitle}>
      <AddTaskForm key={openKey} shownDate={shownDate} titleRef={titleRef} onClose={onClose} onAdd={onAdd} />
    </EventModal>
  );
});

function AddTaskForm({
  shownDate,
  titleRef,
  onClose,
  onAdd,
}: {
  shownDate: string | null;
  titleRef: RefObject<InputRef | null>;
  onClose: () => void;
  onAdd: (title: string, time: string | null) => void;
}) {
  const sfx = useSfx();
  const reduced = useReducedMotion();
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('');
  const [titleErr, setTitleErr] = useState(false);
  const [timeErr, setTimeErr] = useState(false);
  const [titleFocus, setTitleFocus] = useState(false);
  const [flavor] = useState(pickFlavor);
  const timeRef = useRef<InputRef>(null);
  const shake = useSharedValue(0);

  useEffect(() => {
    // Autofocus; onShow also focuses (Android needs the window to be shown first).
    const t = setTimeout(() => titleRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [titleRef]);

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
    sfx.add();
    onAdd(t, tm);
  };

  return (
    <>
      <EventScene />
      <EvBody>
        <Text style={evText.flavor}>{flavor}</Text>
        <Text style={evText.day}>
          Eklenecek gün: <Text style={evText.dayB}>{shownDate ? dayLabel(parseYmd(shownDate)) : ''}</Text>
        </Text>
        <Text style={evText.label} nativeID="lblTitle">Görev başlığı</Text>
        <Animated.View style={shakeStyle}>
          <TextInput
            ref={titleRef}
            value={title}
            onChangeText={(v) => {
              setTitle(v);
              if (v.trim()) setTitleErr(false);
            }}
            maxLength={200}
            placeholder="Örn. Fatura öde"
            placeholderTextColor="#9b8762"
            returnKeyType="done"
            submitBehavior="submit"
            onSubmitEditing={submit}
            onFocus={() => setTitleFocus(true)}
            onBlur={() => setTitleFocus(false)}
            autoCorrect
            autoCapitalize="sentences"
            accessibilityLabel="Görev başlığı"
            accessibilityLabelledBy="lblTitle"
            style={[inp.base, titleFocus && inp.focus, titleErr && inp.err]}
          />
        </Animated.View>
        {titleErr && (
          <Text style={evText.hint} accessibilityLiveRegion="assertive">
            Lütfen bir görev başlığı yazın.
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
      </EvBody>
      <EvOpts>
        <OptionButton kind="yes" icon={<YesGlyph />} label="Ekle" sub="Kaydı deftere işle" onPress={submit} sound={null} />
        <OptionButton kind="no" icon={<NoGlyph />} label="İptal" sub="Vazgeç, defteri kapat" onPress={onClose} />
      </EvOpts>
    </>
  );
}
