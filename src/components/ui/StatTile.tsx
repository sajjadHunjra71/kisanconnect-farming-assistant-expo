import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = { icon: IconName; label: string; value: string; onHero?: boolean };

export function StatTile({ icon, label, value, onHero }: Props) {
  const { colors, spacing } = useTheme();
  const { row } = useDirection();
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={16} tint={onHero ? colors.onHeroMuted : colors.inkMuted} />
        <Text variant="caption" style={{ color: onHero ? colors.onHeroMuted : colors.inkMuted }}>
          {label}
        </Text>
      </View>
      <Text variant="title" latin style={{ color: onHero ? colors.onHero : colors.ink }}>
        {value}
      </Text>
    </View>
  );
}
