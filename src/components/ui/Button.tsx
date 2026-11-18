import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { touchTarget, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'accent' | 'ghost' | 'danger';
type Size = 'md' | 'lg';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconPosition?: 'start' | 'end';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  icon,
  iconPosition = 'start',
  loading,
  disabled,
  fullWidth = true,
  style,
  accessibilityHint,
}: ButtonProps) {
  const { colors, radius } = useTheme();
  const { row } = useDirection();

  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.ink, border: colors.border },
    accent: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];

  const height = size === 'lg' ? 56 : touchTarget;
  const iconEl = icon ? <Icon name={icon} size={20} tint={palette.fg} directional={icon.includes('arrow')} /> : null;

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={[
        styles.base,
        {
          height,
          borderRadius: radius.lg,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          flexDirection: row,
          opacity: disabled ? 0.5 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          paddingHorizontal: size === 'lg' ? 24 : 18,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={[styles.content, { flexDirection: row }]}>
          {iconPosition === 'start' && iconEl}
          <Text variant="title" numberOfLines={1} style={{ color: palette.fg, flexShrink: 1 }}>
            {label}
          </Text>
          {iconPosition === 'end' && iconEl}
        </View>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  content: { alignItems: 'center', gap: 10, maxWidth: '100%' },
});
