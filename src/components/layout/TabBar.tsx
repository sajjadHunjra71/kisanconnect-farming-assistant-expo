import type { BottomTabBarProps } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type TabKey = 'index' | 'weather' | 'scan' | 'assistant' | 'farm';

const TABS: Record<TabKey, { icon: IconName; iconActive: IconName; label: 'tabs.home' | 'tabs.weather' | 'tabs.scan' | 'tabs.assistant' | 'tabs.farm' }> = {
  index: { icon: 'home-outline', iconActive: 'home', label: 'tabs.home' },
  weather: { icon: 'weather-partly-cloudy', iconActive: 'weather-partly-cloudy', label: 'tabs.weather' },
  scan: { icon: 'line-scan', iconActive: 'line-scan', label: 'tabs.scan' },
  assistant: { icon: 'message-text-outline', iconActive: 'message-text', label: 'tabs.assistant' },
  farm: { icon: 'sprout-outline', iconActive: 'sprout', label: 'tabs.farm' },
};

/** Floating pill tab bar with a raised centre "Scan" action — the app's most important tool. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { colors, radius, elevation } = useTheme();
  const { row } = useDirection();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 16 }}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: row,
          alignItems: 'center',
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          height: 72,
          paddingHorizontal: 6,
          ...elevation.floating,
          shadowColor: colors.shadow,
        }}>
        {state.routes.map((route, index) => {
          const key = route.name as TabKey;
          const tab = TABS[key];
          if (!tab) return null;
          const focused = state.index === index;
          const onPress = () => {
            if (!focused) navigateToTab(route.key);
          };

          if (key === 'scan') {
            return (
              <View key={route.key} style={{ flex: 1, alignItems: 'center' }}>
                <PressableScale
                  onPress={onPress}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={t(tab.label)}
                  style={{
                    width: 62,
                    height: 62,
                    marginTop: -30,
                    borderRadius: 31,
                    backgroundColor: colors.accent,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 4,
                    borderColor: colors.background,
                    ...elevation.floating,
                    shadowColor: colors.shadow,
                  }}>
                  <Icon name="line-scan" size={28} color="onAccent" />
                </PressableScale>
                <Text variant="caption" color={focused ? 'ink' : 'inkSubtle'} style={{ marginTop: 2 }}>
                  {t(tab.label)}
                </Text>
              </View>
            );
          }

          return (
            <PressableScale
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={t(tab.label)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: 60 }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: focused ? colors.primarySoft : 'transparent' }}>
                <Icon name={focused ? tab.iconActive : tab.icon} size={22} color={focused ? 'primary' : 'inkSubtle'} />
              </View>
              <Text variant="caption" color={focused ? 'ink' : 'inkSubtle'} numberOfLines={1}>
                {t(tab.label)}
              </Text>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}
