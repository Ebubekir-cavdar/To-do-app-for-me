import { useState, type ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useData } from '../data/DataProvider';
import { signInErrorCode } from '../data/types';
import { C, F, G, SH } from '../theme';
import { EvBody, EvOpts, evText } from './EventModal';
import { EventScene } from './EventScene';
import { GoogleGlyph, SealIcon } from './icons';
import { GoldFrame, OptionButton } from './primitives';

/** Shared full-screen backdrop for the sign-in and loading screens. */
function Backdrop({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.page}>
      <ScrollView
        contentContainerStyle={[s.center, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Event-popup style sign-in ("Görev Defteri"). */
export function SignInScreen() {
  const { signIn } = useData();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    signIn()
      .catch((e: unknown) => {
        if (signInErrorCode(e) === 'cancelled') return;
        const msg = e instanceof Error && e.message ? e.message : 'Giriş yapılamadı. Lütfen tekrar deneyin.';
        setError(msg);
      })
      .finally(() => setBusy(false));
  };

  return (
    <Backdrop>
      <GoldFrame style={s.window} fill={G.event} fillColor="#232a33" shadow={SH.event}>
        <Text accessibilityRole="header" style={s.title}>Görev Defteri</Text>
        <EventScene />
        <EvBody>
          <Text style={evText.flavor}>
            Divan toplandı, kâtipler hazır. Defterin mührünü açmak için kimliğinizi bildirin; kayıtlarınız her cihazda sizi bekleyecek.
          </Text>
          {error ? (
            <Text style={[evText.hint, { marginTop: 2 }]} accessibilityLiveRegion="assertive">
              {error}
            </Text>
          ) : null}
        </EvBody>
        <EvOpts>
          <OptionButton
            kind="yes"
            icon={busy ? <ActivityIndicator size="small" color={C.goldHi} /> : <GoogleGlyph />}
            label={busy ? 'Giriş yapılıyor…' : 'Google ile giriş yap'}
            sub="Hesabınla defteri aç"
            onPress={onSignIn}
            disabled={busy}
          />
        </EvOpts>
      </GoldFrame>
    </Backdrop>
  );
}

/** 'loading' auth state: splash-like seal + title. */
export function LoadingScreen() {
  return (
    <Backdrop>
      <View style={s.loading} accessible accessibilityLabel="Görev Defteri yükleniyor">
        <SealIcon size={64} />
        <Text style={s.loadTitle}>Görev Defteri</Text>
        <Text style={s.loadSub}>Defter açılıyor…</Text>
      </View>
    </Backdrop>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.page, backgroundImage: G.page },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  window: { width: '100%', maxWidth: 384 },
  title: {
    paddingTop: 11,
    paddingBottom: 10,
    paddingHorizontal: 30,
    textAlign: 'center',
    fontFamily: F.head700,
    fontSize: 19,
    lineHeight: 22.8,
    letterSpacing: 1.14,
    color: C.goldHi,
    backgroundColor: '#363f4a',
    backgroundImage: G.evTitle,
    borderBottomWidth: 2,
    borderBottomColor: C.goldMid,
    boxShadow: SH.evTitle,
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  loading: { alignItems: 'center', gap: 10 },
  loadTitle: { fontFamily: F.head700, fontSize: 22, letterSpacing: 1.3, color: C.goldHi, marginTop: 6 },
  loadSub: { fontFamily: F.body400i, fontSize: 15, color: C.steel },
});
