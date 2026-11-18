import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = { title: string; actionLabel?: string; onAction?: () => void; overline?: string };

export function SectionHeader({ title, actionLabel, onAction, overline }: Props) {
  const { row } = useDirection();
  return (
    <View style={{ flexDirection: row, alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        {overline ? (
          <Text variant="overline" color="inkSubtle">
            {overline}
          </Text>
        ) : null}
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {actionLabel ? (
        <PressableScale onPress={onAction} accessibilityRole="button" hitSlop={10}>
          <Text variant="label" color="primary">
            {actionLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
}
