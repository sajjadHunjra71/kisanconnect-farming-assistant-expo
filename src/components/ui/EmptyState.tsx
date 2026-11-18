import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = { icon: IconName; title: string; body?: string; actionLabel?: string; onAction?: () => void };

export function EmptyState({ icon, title, body, actionLabel, onAction }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xxxl, paddingHorizontal: spacing.xl }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={32} color="primary" />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      {body ? (
        <Text variant="body" color="inkMuted" align="center">
          {body}
        </Text>
      ) : null}
      {actionLabel ? <Button label={actionLabel} onPress={onAction} fullWidth={false} size="md" /> : null}
    </View>
  );
}
