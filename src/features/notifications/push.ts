/**
 * Weather push alerts: get this phone's Expo push token and register it for the
 * signed-in user (supabase rpc register_push_token). Needs a real device and an
 * EAS project id (app.json → extra.eas.projectId, set by `eas init`).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

const TOKEN_KEY = 'kisanconnect-push-token';

export type PushResult = 'registered' | 'denied' | 'unsupported' | 'no-project' | 'failed';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function projectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function registerForWeatherPush(): Promise<PushResult> {
  if (!supabase || Platform.OS === 'web' || !Device.isDevice) return 'unsupported';
  const id = projectId();
  if (!id) return 'no-project';
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status === 'undetermined') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('weather', { name: 'Weather alerts', importance: Notifications.AndroidImportance.HIGH });
    }
    const token = (await Notifications.getExpoPushTokenAsync({ projectId: id })).data;
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
    if (error) return 'failed';
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** Stop alerts on this phone for the current user (call while still signed in). */
export async function unregisterWeatherPush(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token || !supabase) return;
  await supabase.rpc('unregister_push_token', { p_token: token }).then(
    () => undefined,
    () => undefined,
  );
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}
