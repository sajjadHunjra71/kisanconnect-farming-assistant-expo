import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

import { pendingCount, requestSync } from '@/sync/sync-manager';

/**
 * Ask before a user-pressed sign-out. With unsent changes: Sync now / Sign out anyway / Cancel.
 * Resolves true when the caller should sign out.
 */
export async function confirmSignOut(t: TFunction): Promise<boolean> {
  const count = await pendingCount();
  if (count === 0) {
    return new Promise((resolve) =>
      Alert.alert(t('settings.signOutConfirm'), undefined, [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('settings.signOut'), onPress: () => resolve(true) },
      ], { onDismiss: () => resolve(false) }),
    );
  }
  return new Promise((resolve) =>
    Alert.alert(t('sync.unsentTitle', { count }), t('sync.unsentBody'), [
      {
        text: t('sync.syncNow'),
        onPress: async () => {
          await requestSync('full');
          resolve(await confirmSignOut(t));
        },
      },
      { text: t('sync.signOutAnyway'), style: 'destructive', onPress: () => resolve(true) },
      { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
    ], { onDismiss: () => resolve(false) }),
  );
}
