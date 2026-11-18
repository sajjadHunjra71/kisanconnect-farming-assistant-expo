import { View } from 'react-native';

import { Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export function BulletList({ items, numbered }: { items: string[]; numbered?: boolean }) {
  const { colors } = useTheme();
  const { row } = useDirection();
  return (
    <View style={{ gap: 12 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: row, gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {numbered ? (
              <Text variant="caption" latin color="primary">
                {i + 1}
              </Text>
            ) : (
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
            )}
          </View>
          <Text variant="body" style={{ flex: 1 }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}
