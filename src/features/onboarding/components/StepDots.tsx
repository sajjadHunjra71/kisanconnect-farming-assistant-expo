import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export function StepDots({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  const { row } = useDirection();
  return (
    <View style={{ flexDirection: row, gap: 6 }} accessibilityLabel={`${current} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ height: 6, width: i + 1 === current ? 24 : 6, borderRadius: 3, backgroundColor: i + 1 <= current ? colors.primary : colors.border }} />
      ))}
    </View>
  );
}
