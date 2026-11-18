import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';
import type { DailyForecast } from '@/types/domain';
import { conditionIcon } from '../weather-icons';

type Props = { day: DailyForecast; weekMin: number; weekMax: number };

/** One forecast row with a temperature range bar scaled to the whole week. */
export function DailyRow({ day, weekMin, weekMax }: Props) {
  const { colors, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const span = weekMax - weekMin || 1;
  const start = ((day.minC - weekMin) / span) * 100;
  const width = ((day.maxC - day.minC) / span) * 100;

  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md, minHeight: 52 }}>
      <Text variant="bodyStrong" style={{ width: 72 }}>
        {l(day.day)}
      </Text>
      <View style={{ width: 52, flexDirection: row, alignItems: 'center', gap: 4 }}>
        <Icon name={conditionIcon[day.condition]} size={22} />
        {day.rainMm > 0 ? (
          <Text variant="caption" latin color="info">
            {day.rainMm}
          </Text>
        ) : null}
      </View>
      <Text variant="body" latin color="inkMuted" style={{ width: 32 }} align="end">
        {day.minC}°
      </Text>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt, flexDirection: row }}>
        <View style={{ width: `${start}%` }} />
        <View style={{ width: `${Math.max(width, 6)}%`, height: 6, borderRadius: 3, backgroundColor: colors.accent }} />
      </View>
      <Text variant="bodyStrong" latin style={{ width: 32 }}>
        {day.maxC}°
      </Text>
    </View>
  );
}
