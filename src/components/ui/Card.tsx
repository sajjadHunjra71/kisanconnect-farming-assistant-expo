import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';
import { PressableScale } from './PressableScale';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  tone?: keyof Pick<Palette, 'surface' | 'surfaceAlt' | 'primarySoft' | 'accentSoft' | 'dangerSoft' | 'infoSoft' | 'warningSoft' | 'successSoft'>;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function Card({ children, onPress, tone = 'surface', padded = true, elevated = false, style, accessibilityLabel }: CardProps) {
  const { colors, radius, elevation, spacing } = useTheme();
  const cardStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: colors[tone],
      borderRadius: radius.lg,
      padding: padded ? spacing.lg : 0,
      borderWidth: tone === 'surface' ? 1 : 0,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    elevated && { ...elevation.card, shadowColor: colors.shadow },
    style,
  ];

  if (onPress) {
    return (
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={cardStyle}>
        {children}
      </PressableScale>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}
