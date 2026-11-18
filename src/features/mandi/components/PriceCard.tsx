import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, Sparkline, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { useTheme } from '@/theme';
import type { MandiPrice } from '@/types/domain';

const fmt = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

export function PriceCard({ price, compact }: { price: MandiPrice; compact?: boolean }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row, alignEnd } = useDirection();
  const l = useLocalized();
  const crop = CROPS[price.cropId];
  const up = price.changePct > 0;
  const flat = price.changePct === 0;
  const trendColor = flat ? colors.inkMuted : up ? colors.success : colors.danger;

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={crop.icon} size={24} color="warning" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="title">{l(crop.name)}</Text>
          <Text variant="caption" color="inkMuted">
            {l(price.market)} · {l(price.unit)}
          </Text>
        </View>
        <View style={{ alignItems: alignEnd }}>
          <Text variant="h3" latin>
            {fmt(price.avg)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Icon name={flat ? 'minus' : up ? 'arrow-up' : 'arrow-down'} size={14} tint={trendColor} />
            <Text variant="caption" latin style={{ color: trendColor }}>
              {Math.abs(price.changePct).toFixed(1)}%
            </Text>
          </View>
        </View>
      </View>
      {!compact ? (
        <View style={{ flexDirection: row, alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md }}>
          <View style={{ gap: 2 }}>
            <Text variant="caption" color="inkSubtle">
              {t('mandi.range', { min: fmt(price.min), max: fmt(price.max) })}
            </Text>
            <Text variant="caption" color="inkSubtle">
              {t('mandi.updated', { date: price.date })}
            </Text>
          </View>
          <Sparkline data={price.history} width={110} height={36} color={trendColor} />
        </View>
      ) : null}
    </Card>
  );
}
