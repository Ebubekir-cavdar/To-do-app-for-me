import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DataProvider, useData } from '../data/DataProvider';
import { C, fontAssets } from '../theme';
import { NotificationsProvider } from '../notifications';
import { LogProvider } from '../ui/MessageLog';
import { SfxProvider } from '../ui/Sfx';
import { LoadingScreen, SignInScreen } from '../ui/SignInScreen';

// Turkish locale on web so Cinzel / Alegreya SC use their Turkish forms (dotted small-cap İ).
if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = 'tr';

// Keep the native splash up until the fonts are ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || !!fontError;

  useEffect(() => {
    if (fontError) console.warn('[fonts] failed to load', fontError);
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.page }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <SfxProvider>
          <DataProvider>
            <AuthGate />
          </DataProvider>
        </SfxProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** 'loading' → splash-like screen, 'signedOut' → sign-in event, 'signedIn' → the app. */
function AuthGate() {
  const { status } = useData();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signedOut') return <SignInScreen />;
  return (
    <LogProvider>
      <NotificationsProvider>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: C.page } }} />
      </NotificationsProvider>
    </LogProvider>
  );
}
