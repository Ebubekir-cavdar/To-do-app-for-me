import { memo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useData } from '../data/DataProvider';
import { useNotifications } from '../notifications';
import { C, F, TS } from '../theme';
import { Chip } from './Chip';
import { dw } from './DeleteModal';
import { EvBody, EventModal, EvOpts, evText } from './EventModal';
import { CharterArt, DoorGlyph, NoGlyph } from './icons';
import { useLog } from './MessageLog';
import { MetalButton, OptionButton } from './primitives';
import { useSfx } from './Sfx';

/**
 * "Defter Sahibi" decision window: who is signed in, the tap-sound setting, the
 * notification settings, and sign-out (Firebase mode only). Tall content scrolls
 * inside EventModal.
 */
export const AccountModal = memo(function AccountModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { mode, user, signOut } = useData();
  const [busy, setBusy] = useState(false);
  const local = mode === 'local';
  const { tapEnabled, setTapEnabled } = useSfx();
  const notif = useNotifications();
  const log = useLog();
  const unsupported = notif.permission === 'unsupported';

  const doSignOut = () => {
    setBusy(true);
    signOut()
      .catch((e) => console.warn('[auth] sign-out failed', e))
      .finally(() => {
        setBusy(false);
        onClose();
      });
  };

  const askPermission = () => {
    notif
      .requestPermission()
      .then((ok) => { if (ok) log('Ulaklar yola çıktı.', 'ferman'); })
      .catch((e) => console.warn('[notifications] permission request failed', e))
      .finally(notif.markAsked);
  };

  const sendTest = () => {
    notif.sendTestReminder().catch((e) => console.warn('[notifications] test reminder failed', e));
    log('Örnek ulak 3 saniye içinde geliyor…', 'add');
  };

  return (
    <EventModal visible={visible} onClose={onClose} title="Defter Sahibi" small>
      <EvBody>
        <View style={dw.row}>
          <CharterArt />
          <View style={dw.col}>
            {local ? (
              <>
                <Text style={dw.title}>Önizleme modu</Text>
                <Text style={dw.meta}>Giriş gerekmez</Text>
                <Text style={[evText.flavor, { marginBottom: 0 }]}>Kayıtlar yalnızca bu cihazda, bu tarayıcıda tutulur.</Text>
              </>
            ) : (
              <>
                <Text style={dw.title}>{user?.name || 'Adsız hükümdar'}</Text>
                {user?.email ? <Text style={dw.meta}>{user.email}</Text> : null}
                <Text style={[evText.flavor, { marginBottom: 0 }]}>Defter bu hesabın mührüyle korunuyor; kayıtlar cihazlar arasında eşitlenir.</Text>
              </>
            )}
          </View>
        </View>

        <View style={[st.setting, st.rule]}>
          <Text style={[evText.label, st.settingLabel]}>Dokunma sesi</Text>
          <OnOff
            name="Dokunma sesi"
            on={tapEnabled}
            // No press sound here: turning it on plays one confirmation tap itself.
            silent
            onChange={setTapEnabled}
          />
        </View>

        <View style={st.rule}>
          <Text accessibilityRole="header" style={st.section}>Bildirimler</Text>
          <View style={st.setting}>
            <View style={st.settingLabel}>
              <Text style={[evText.label, st.labelTight]}>Sabah özeti</Text>
              <Text style={st.labelSub}>Her sabah 09:00 · sessiz</Text>
            </View>
            <OnOff
              name="Sabah özeti"
              on={notif.settings.daily}
              disabled={unsupported}
              onChange={(daily) => notif.setSettings({ daily })}
            />
          </View>
          <View style={[st.setting, { marginTop: 8 }]}>
            <View style={st.settingLabel}>
              <Text style={[evText.label, st.labelTight]}>Hatırlatma</Text>
              <Text style={st.labelSub}>30 dk önce · sesli</Text>
            </View>
            <OnOff
              name="Hatırlatma"
              on={notif.settings.reminders}
              disabled={unsupported}
              onChange={(reminders) => notif.setSettings({ reminders })}
            />
          </View>

          {notif.permission === 'unsupported' && <Text style={st.note}>Bu cihazda bildirim yok</Text>}
          {notif.permission === 'denied' && (
            <>
              <Text style={[st.note, st.noteWarn]}>Bildirim izni kapalı</Text>
              <SmallButton label="Android ayarlarını aç" onPress={() => { Linking.openSettings().catch(() => {}); }} />
            </>
          )}
          {notif.permission === 'undetermined' && <SmallButton label="Bildirim izni ver" onPress={askPermission} />}
          <SmallButton
            label="Örnek hatırlatma gönder"
            onPress={sendTest}
            disabled={notif.permission !== 'granted'}
          />
        </View>
      </EvBody>
      <EvOpts>
        {!local && (
          <OptionButton
            kind="danger"
            icon={<DoorGlyph />}
            label={busy ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
            sub="Mührü kaldır, defteri kapat"
            onPress={doSignOut}
            disabled={busy}
          />
        )}
        <OptionButton kind="no" icon={<NoGlyph />} label="Kapat" sub="Deftere dön" onPress={onClose} />
      </EvOpts>
    </EventModal>
  );
});

/** "Açık | Kapalı" segmented chips (same chips as the Ferman Süre selector). */
function OnOff({
  name,
  on,
  onChange,
  disabled,
  silent,
}: {
  name: string;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  silent?: boolean;
}) {
  const sound = silent ? null : undefined;
  return (
    <View style={st.seg} accessibilityRole="radiogroup" accessibilityLabel={name}>
      <Chip label="Açık" a11y={`${name} açık`} on={on} radio sound={sound} disabled={disabled} onPress={() => onChange(true)} style={st.chip} />
      <Chip label="Kapalı" a11y={`${name} kapalı`} on={!on} radio sound={sound} disabled={disabled} onPress={() => onChange(false)} style={st.chip} />
    </View>
  );
}

/** Compact bevelled metal button on the parchment. */
function SmallButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <MetalButton
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[st.btn, disabled && st.btnOff]}
    >
      <Text style={st.btnTxt}>{label}</Text>
    </MetalButton>
  );
}

const st = StyleSheet.create({
  rule: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(106,82,51,0.35)',
  },
  section: { marginBottom: 6, fontFamily: F.head700, fontSize: 15, lineHeight: 18, letterSpacing: 0.9, color: C.ink },
  setting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingLabel: { flex: 1, minWidth: 0, marginTop: 0, marginBottom: 0 },
  labelTight: { marginTop: 0, marginBottom: 0 },
  labelSub: { fontFamily: F.body400i, fontSize: 13.5, lineHeight: 16, color: C.inkSoft },
  seg: { flexDirection: 'row', gap: 4 },
  chip: { minWidth: 70, paddingHorizontal: 8 },
  note: { marginTop: 10, fontFamily: F.body400i, fontSize: 15, lineHeight: 19, color: C.inkSoft },
  noteWarn: { fontFamily: F.body700, color: C.redInk },
  btn: { marginTop: 10, minHeight: 44, paddingHorizontal: 12 },
  btnOff: { opacity: 0.45 },
  btnTxt: { fontFamily: F.body700, fontSize: 16, lineHeight: 19, color: C.cream, ...TS },
});
