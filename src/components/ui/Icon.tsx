import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { StyleProp, TextStyle } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: keyof Palette;
  /** Raw colour override, e.g. on gradients. */
  tint?: string;
  /** Mirror in RTL (chevrons, arrows, send). */
  directional?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Icon({ name, size = 22, color = 'ink', tint, directional, style }: IconProps) {
  const { colors } = useTheme();
  const { flipX } = useDirection();
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={tint ?? colors[color]}
      style={[directional ? { transform: flipX } : null, style]}
    />
  );
}
