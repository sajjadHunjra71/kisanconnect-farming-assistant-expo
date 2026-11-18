import { Redirect } from 'expo-router';

import { useSettingsStore } from '@/store/settings-store';

export default function Index() {
  const hasOnboarded = useSettingsStore((s) => s.hasOnboarded);
  return <Redirect href={hasOnboarded ? '/(tabs)' : '/welcome'} />;
}
