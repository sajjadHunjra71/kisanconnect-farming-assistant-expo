import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AlertsLocal } from '@/db/alerts-local';
import { PK_UTC_OFFSET, normalizePrefs } from '@/engine';
import { pickLocalNotifications } from '@/sync/alerts-sync';

import { ensureAndroidChannel, notificationsAllowed } from './push';

/**
 * Show a LOCAL notification for new unread alerts the server didn't push to this phone
 * (no push token, simulator, Expo Go on Android). Respects kinds + quiet hours.
 */
export async function showLocalAlerts(local: AlertsLocal, rawPrefs: unknown): Promise<number> {
  if (Platform.OS === 'web' || !(await notificationsAllowed())) return 0;
  const pk = new Date(Date.now() + PK_UTC_OFFSET * 1000).toISOString();
  const picks = pickLocalNotifications(await local.list(), normalizePrefs(rawPrefs), pk.slice(11, 16), pk.slice(0, 10));
  if (picks.length === 0) return 0;
  await ensureAndroidChannel();
  const first = picks[0];
  await Notifications.scheduleNotificationAsync({
    content: {
      title: first.title,
      body: picks.length > 1 ? `${first.body} (+${picks.length - 1})` : first.body,
      data: { type: 'weather', alertId: first.id },
      sound: 'default',
    },
    trigger: null,
  });
  await local.markNotified(
    picks.map((p) => p.id),
    new Date().toISOString(),
  );
  return picks.length;
}
