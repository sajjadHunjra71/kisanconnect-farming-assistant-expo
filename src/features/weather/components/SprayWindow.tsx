import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type Slot = { label: string; ok: boolean };

/** 24h timeline of good/avoid spray slots derived from rain + wind rules. */
export function SprayWindow({ slots }: { slots: Slot[] }) {
  const { colors, spacing } = useTheme();
  const { row } = useDirection();
  const { t } = useTranslation();

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
        <Icon name="spray" size={20} color="primary" />
        <Text variant="title">{t('weather.sprayWindow')}</Text>
      </View>
      <View style={{ flexDirection: row, gap: 4 }}>
        {slots.map((s, i) => (
          <View key={i} style={{ flex: 1, gap: 6 }}>
            <View style={{ height: 28, borderRadius: 8, backgroundColor: s.ok ? colors.success : colors.dangerSoft }} />
            <Text variant="caption" latin color="inkSubtle" align="center">
              {s.label}
            </Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: row, gap: spacing.lg }}>
        <Legend color={colors.success} label={t('weather.sprayGood')} />
        <Legend color={colors.dangerSoft} label={t('weather.sprayAvoid')} />
      </View>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { row } = useDirection();
  return (
    <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" color="inkMuted">
        {label}
      </Text>
    </View>
  );
}
