import { Redirect } from 'expo-router';

import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';

export default function Index() {
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return null;
  // Signed-out users always start at welcome; demo mode (no keys) opens the sample-data app.
  if (status === 'signedOut') return <Redirect href="/welcome" />;
  return <Redirect href={hasOnboarded ? '/(tabs)' : '/welcome'} />;
}
