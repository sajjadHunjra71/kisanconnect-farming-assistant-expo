import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export function FormError({ message }: { message?: string | null }) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: row, gap: spacing.sm, alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerSoft }}>
      <Icon name="alert-circle-outline" size={20} color="danger" />
      <Text variant="body" color="danger" style={{ flex: 1 }}>
        {message}
      </Text>
    </View>
  );
}
