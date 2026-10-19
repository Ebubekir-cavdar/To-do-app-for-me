import { memo, useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useNotifications } from '../notifications';
import { EvBody, EventModal, EvOpts, evText } from './EventModal';
import { CourierScene } from './EventScene';
import { NoGlyph, YesGlyph } from './icons';
import { useLog } from './MessageLog';
import { OptionButton } from './primitives';

/** Delay before the explainer appears, so the week has rendered first. */
const SHOW_AFTER_MS = 700;

/**
 * "Ulaklar Hazır" — in-app explainer shown once before the OS notification-permission
 * dialog (while `shouldAskPermission`). `blocked` keeps it back while another popup is open.
 */
export const NotifyAskModal = memo(function NotifyAskModal({ blocked }: { blocked: boolean }) {
  const { shouldAskPermission, requestPermission, markAsked } = useNotifications();
  const log = useLog();
  const [ready, setReady] = useState(false);
  // Hides the window as soon as the user answers, while the OS dialog / markAsked settle.
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), SHOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  const visible = shouldAskPermission && ready && !answered && !blocked;

  const allow = () => {
    setAnswered(true);
    requestPermission()
      .then((ok) => { if (ok) log('Ulaklar yola çıktı.', 'ferman'); })
      .catch((e) => console.warn('[notifications] permission request failed', e))
      .finally(markAsked);
  };
  const later = () => {
    setAnswered(true);
    markAsked();
  };

  return (
    <EventModal visible={visible} onClose={later} title="Ulaklar Hazır" small>
      <CourierScene />
      <EvBody>
        <Text style={evText.flavor}>
          Saray ulakları emrinizi bekliyor. Her sabah 09:00&apos;da günün işlerini sessizce önünüze serecekler;
          saati belli görevlerden 30 dakika önce de borazanla haber verecekler.
        </Text>
        <Text style={[evText.day, { marginBottom: 0 }]}>
          Bunun için Android&apos;in bildirim iznine ihtiyaç var.
        </Text>
      </EvBody>
      <EvOpts>
        <OptionButton kind="yes" icon={<YesGlyph />} label="İzin ver" sub="Ulakları yola çıkar" onPress={allow} />
        <OptionButton kind="no" icon={<NoGlyph />} label="Şimdi değil" sub="Hesap penceresinden sonra açılabilir" onPress={later} />
      </EvOpts>
    </EventModal>
  );
});
