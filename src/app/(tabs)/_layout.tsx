import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components/layout/TabBar';
import { useAuthStore } from '@/store/auth-store';

export default function TabsLayout() {
  const status = useAuthStore((s) => s.status);
  if (status === 'loading') return null;
  if (status === 'signedOut') return <Redirect href="/sign-in" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="weather" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="assistant" />
      <Tabs.Screen name="farm" />
    </Tabs>
  );
}
