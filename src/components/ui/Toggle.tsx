import { Switch } from 'react-native';

import { useTheme } from '@/theme';

type Props = { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel: string };

export function Toggle({ value, onValueChange, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={accessibilityLabel}
      trackColor={{ false: colors.surfaceAlt, true: colors.primary }}
      thumbColor={colors.surfaceRaised}
      ios_backgroundColor={colors.surfaceAlt}
    />
  );
}
