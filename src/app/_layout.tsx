import '@/i18n';

import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { NotoNastaliqUrdu_400Regular, NotoNastaliqUrdu_700Bold } from '@expo-google-fonts/noto-nastaliq-urdu';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components/brand/BrandSplash';
import { usePushAlerts } from '@/features/notifications/use-push-alerts';
import { useLanguageSync } from '@/i18n/use-language-sync';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { ThemeProvider, useTheme } from '@/theme';

void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { colors, scheme } = useTheme();
  useLanguageSync();
  usePushAlerts();
  useEffect(() => useAuthStore.getState().init(), []);
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'slide_from_right' }}>
        <Stack.Screen name="scan/[id]" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="expert/ask" options={{ presentation: 'modal' }} />
        <Stack.Screen name="auth/callback" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="auth/reset" options={{ animation: 'fade' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    NotoNastaliqUrdu_400Regular,
    NotoNastaliqUrdu_700Bold,
  });
  const ready = fontsLoaded && hydrated;
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <RootStack />
          {showSplash ? <BrandSplash onDone={() => setShowSplash(false)} /> : null}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
