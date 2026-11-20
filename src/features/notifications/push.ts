/**
 * Weather push alerts: get this phone's Expo push token and register it for the
 * signed-in user (rpc register_push_token). Needs a real device and an EAS project id
 * (app.json → extra.eas.projectId, set by `eas init`). Never asks for permission by
 * itself: see askForAlerts (asked after the first farm is saved).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'kisanconnect-push-token';

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'no-project' | 'failed';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await Notifications.getPermissionsAsync()).status === 'granted';
}

export async function ensureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('weather', { name: 'Weather alerts', importance: Notifications.AndroidImportance.HIGH });
  }
}

/** Register this phone for pushes if notifications are already allowed (no prompt). */
export async function registerForWeatherPush(): Promise<PushResult> {
  if (!supabase || Platform.OS === 'web') return 'unsupported';
  try {
    if (!(await notificationsAllowed())) return 'denied';
    await ensureAndroidChannel();
    if (!Device.isDevice) return 'unsupported'; // simulators can't get push tokens (local notifications still work)
    const id = projectId();
    if (!id) return 'no-project';
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    if (error) return 'failed';
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** Stop pushes to this phone for the current user (call while still signed in). */
export async function unregisterWeatherPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token || !supabase) return;
  await supabase
    .from('push_tokens')
    .delete()
    .eq('token', token)
    .then(
      () => undefined,
      () => undefined,
    );
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}
