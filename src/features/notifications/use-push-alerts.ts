import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

import { registerForWeatherPush, unregisterWeatherPush } from './push';

/** Keeps this phone's push registration in step with sign-in and the Settings toggle. */
export function usePushAlerts() {
  const userId = useAuthStore((s) => (s.status === 'signedIn' ? (s.session?.user.id ?? null) : null));
  const enabled = useSettingsStore((s) => s.notifications.weather);

  useEffect(() => {
    if (!userId || Platform.OS === 'web') return;
    void (enabled ? registerForWeatherPush() : unregisterWeatherPush());
  }, [userId, enabled]);

  // Tapping a weather alert opens the Weather tab.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      if ((r.notification.request.content.data as { type?: string } | undefined)?.type === 'weather') router.push('/(tabs)/weather');
    });
    return () => sub.remove();
  }, []);
}
