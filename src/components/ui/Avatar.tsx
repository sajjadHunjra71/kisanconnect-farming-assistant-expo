import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Text } from './Text';

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text variant="title" latin style={{ color: colors.warning }}>
        {initials}
      </Text>
    </View>
  );
}
