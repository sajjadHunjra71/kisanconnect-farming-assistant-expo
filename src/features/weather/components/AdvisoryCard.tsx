import { View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';
import type { Advisory, AdvisoryKind } from '@/types/domain';
import { severityTone } from '../weather-icons';
import type { IconName } from '@/components/ui/Icon';

const kindIcon: Record<AdvisoryKind, IconName> = {
  spray: 'spray',
  irrigation: 'water-outline',
  'disease-risk': 'virus-outline',
  heat: 'thermometer-high',
  frost: 'snowflake',
  rain: 'weather-pouring',
};

export function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const tone = severityTone[advisory.severity];

  return (
    <View
      accessible
      accessibilityLabel={`${l(advisory.title)}. ${l(advisory.body)}`}
      style={{ flexDirection: row, gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors[tone.bg], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={kindIcon[advisory.kind]} size={22} color={tone.fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title">{l(advisory.title)}</Text>
        <Text variant="body" color="inkMuted">
          {l(advisory.body)}
        </Text>
        <Text variant="caption" color="inkSubtle" latin>
          {advisory.source}
        </Text>
      </View>
    </View>
  );
}
