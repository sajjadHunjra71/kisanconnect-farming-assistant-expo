import type { TFunction } from 'i18next';
import * as Notifications from 'expo-notifications';
import { Alert, Platform } from 'react-native';

import { registerForWeatherPush } from './push';

/**
 * Explain, then ask for notification permission. Called once, right after the first farm
 * is saved; does nothing if the user already answered the system prompt.
 */
export async function askForAlerts(t: TFunction): Promise<void> {
  if (Platform.OS === 'web') return;
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'undetermined') return;
  await new Promise<void>((resolve) =>
    Alert.alert(
      t('alerts.askTitle'),
      t('alerts.askBody'),
      [
        { text: t('alerts.notNow'), style: 'cancel', onPress: () => resolve() },
        {
          text: t('alerts.allow'),
          onPress: async () => {
            const res = await Notifications.requestPermissionsAsync();
            if (res.status === 'granted') await registerForWeatherPush();
            resolve();
          },
        },
      ],
      { onDismiss: () => resolve() },
    ),
  );
}
