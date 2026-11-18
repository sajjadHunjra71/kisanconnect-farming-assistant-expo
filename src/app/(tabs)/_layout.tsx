import { Tabs } from 'expo-router/tabs';

import { TabBar } from '@/components/layout/TabBar';

export default function TabsLayout() {
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
