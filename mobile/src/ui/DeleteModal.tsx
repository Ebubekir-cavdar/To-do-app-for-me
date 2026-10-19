import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { dayLabel, parseYmd } from '../lib/dates';
import type { Task } from '../model/task';
import { C, F } from '../theme';
import { EvBody, EventModal, EvOpts, evText, useLatest } from './EventModal';
import { DeleteScrollArt, FermanScrollArt, NoGlyph, TrashGlyph, TrashSeriesGlyph } from './icons';
import { OptionButton } from './primitives';

/**
 * "Görevi Sil" decision window. Visible while `task` is non-null. A task of a Ferman series
 * (recurrenceId set) offers deleting just this day or this and the following days.
 */
export const DeleteModal = memo(function DeleteModal({
  task,
  onClose,
  onDelete,
  onDeleteSeries,
}: {
  task: Task | null;
  onClose: () => void;
  onDelete: (t: Task) => void;
  onDeleteSeries: (t: Task) => void;
}) {
  const t = useLatest(task);
  const recurring = t?.recurrenceId != null;
  return (
    <EventModal visible={task !== null} onClose={onClose} title="Görevi Sil" small>
      <EvBody>
        <View style={dw.row}>
          {recurring ? <FermanScrollArt /> : <DeleteScrollArt />}
          <View style={dw.col}>
            <Text style={dw.title}>«{t?.title}»</Text>
            <Text style={dw.meta}>{t ? dayLabel(parseYmd(t.date)) + (t.time ? ' · ' + t.time : '') : ''}</Text>
            <Text style={[evText.flavor, { marginBottom: 0 }]}>
              {recurring
                ? 'Bu kayıt bir fermanla tekrarlanıyor. Yalnızca bu günü mü, yoksa bu ve sonraki günleri mi kaldıralım?'
                : 'Bu kayıt divan defterinden kalıcı olarak silinecek.'}
            </Text>
          </View>
        </View>
      </EvBody>
      <EvOpts>
        {recurring ? (
          <>
            <OptionButton kind="danger" sound="del" icon={<TrashGlyph />} label="Sadece bunu sil" sub="Yalnızca bu günün kaydı" onPress={() => task && onDelete(task)} />
            <OptionButton
              kind="danger"
              sound="del"
              icon={<TrashSeriesGlyph />}
              label="Bu ve sonrakileri sil"
              sub="Fermanı bu günden itibaren kaldır"
              onPress={() => task && onDeleteSeries(task)}
            />
          </>
        ) : (
          <OptionButton kind="danger" sound="del" icon={<TrashGlyph />} label="Sil" sub="Kaydı defterden kaldır" onPress={() => task && onDelete(task)} />
        )}
        <OptionButton kind="no" icon={<NoGlyph />} label="İptal" sub="Kayıt kalsın" onPress={onClose} />
      </EvOpts>
    </EventModal>
  );
});

/** Shared layout of decision-window bodies (.del-body). */
export const dw = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  col: { flex: 1, minWidth: 0 },
  title: { marginBottom: 4, fontFamily: F.body700, fontSize: 18, lineHeight: 22.5, color: C.ink },
  meta: { marginBottom: 6, fontFamily: F.sc700, fontSize: 14, lineHeight: 16.8, color: C.inkSoft },
});
