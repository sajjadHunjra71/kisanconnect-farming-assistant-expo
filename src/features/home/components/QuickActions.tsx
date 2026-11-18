import { router, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';

type Action = { key: string; icon: IconName; label: string; href: Href; bg: keyof Palette; fg: keyof Palette };

export function QuickActions() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();

  const actions: Action[] = [
    { key: 'scan', icon: 'line-scan', label: t('home.quickScan'), href: '/(tabs)/scan', bg: 'accentSoft', fg: 'warning' },
    { key: 'ask', icon: 'microphone-outline', label: t('home.quickAsk'), href: '/(tabs)/assistant', bg: 'primarySoft', fg: 'primary' },
    { key: 'expert', icon: 'account-tie-outline', label: t('home.quickExpert'), href: '/expert', bg: 'infoSoft', fg: 'info' },
    { key: 'mandi', icon: 'chart-line-variant', label: t('home.quickMandi'), href: '/mandi', bg: 'dangerSoft', fg: 'danger' },
  ];

  return (
    <View style={{ flexDirection: row, gap: spacing.sm }}>
      {actions.map((a) => (
        <PressableScale
          key={a.key}
          onPress={() => router.push(a.href)}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: colors[a.bg], alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={a.icon} size={24} color={a.fg} />
          </View>
          <Text variant="caption" numberOfLines={1} align="center">
            {a.label}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}
