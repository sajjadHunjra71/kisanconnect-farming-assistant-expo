import { ScrollView, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { HourlyForecast } from '@/types/domain';
import { conditionIcon } from '../weather-icons';

export function HourlyStrip({ hours }: { hours: HourlyForecast[] }) {
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const ordered = isRTL ? [...hours].reverse() : hours;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, flexDirection: row, paddingHorizontal: spacing.xl }}>
      {ordered.map((h, i) => {
        const now = (isRTL ? ordered.length - 1 - i : i) === 0;
        return (
          <View
            key={h.hour}
            style={{
              width: 72,
              paddingVertical: spacing.md,
              alignItems: 'center',
              gap: 6,
              borderRadius: radius.lg,
              backgroundColor: now ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: now ? colors.primary : colors.border,
            }}>
            <Text variant="caption" latin color={now ? 'onPrimary' : 'inkMuted'}>
              {h.hour}
            </Text>
            <Icon name={conditionIcon[h.condition]} size={26} color={now ? 'onPrimary' : 'ink'} />
            <Text variant="title" latin color={now ? 'onPrimary' : 'ink'}>
              {h.tempC}°
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Icon name="water" size={12} color={now ? 'onPrimary' : 'info'} />
              <Text variant="caption" latin color={now ? 'onPrimary' : 'info'}>
                {h.rainChance}%
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}
