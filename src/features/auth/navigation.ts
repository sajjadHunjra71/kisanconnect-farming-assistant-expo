import { router } from 'expo-router';

import { useSettingsStore } from '@/store/settings-store';

/** After a successful sign-in: new users finish farm setup, returning users go home. */
export function goAfterAuth() {
  const { hasOnboarded } = useSettingsStore.getState();
  router.replace(hasOnboarded ? '/(tabs)' : '/farm-setup');
}
