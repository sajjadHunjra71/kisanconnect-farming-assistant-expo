import { useState } from 'react';
import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';
import type { FarmTask } from '@/types/domain';

export function TaskItem({ task }: { task: FarmTask }) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const [done, setDone] = useState(task.done);

  return (
    <PressableScale
      onPress={() => setDone((d) => !d)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={l(task.title)}
      scaleTo={0.98}
      style={{ flexDirection: row, alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          borderWidth: 2,
          borderColor: done ? colors.primary : colors.border,
          backgroundColor: done ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {done ? <Icon name="check" size={18} color="onPrimary" /> : null}
      </View>
      <View style={{ flex: 1, gap: 2, opacity: done ? 0.5 : 1 }}>
        <Text variant="bodyStrong" style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
          {l(task.title)}
        </Text>
        <Text variant="caption" color="inkMuted">
          {l(task.detail)}
        </Text>
      </View>
      <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
        <Text variant="caption" color="inkMuted">
          {l(task.due)}
        </Text>
      </View>
    </PressableScale>
  );
}
