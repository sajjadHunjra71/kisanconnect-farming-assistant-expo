import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = { options: Option<T>[]; value: T; onChange: (value: T) => void };

export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  const { colors, radius } = useTheme();
  const { row } = useDirection();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: row, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <PressableScale
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={{
              flex: 1,
              minHeight: 40,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? colors.surfaceRaised : 'transparent',
            }}>
            <Text variant="label" color={active ? 'ink' : 'inkMuted'}>
              {o.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}
