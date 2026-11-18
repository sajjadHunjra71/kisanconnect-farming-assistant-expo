import { touchTarget, useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

type Props = {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  tone?: 'surface' | 'primary' | 'clear' | 'glass';
  size?: number;
  iconColor?: keyof Palette;
  directional?: boolean;
};

export function IconButton({ icon, onPress, accessibilityLabel, tone = 'surface', size = touchTarget, iconColor, directional }: Props) {
  const { colors } = useTheme();
  const bg = {
    surface: colors.surface,
    primary: colors.primary,
    clear: 'transparent',
    glass: 'rgba(255,255,255,0.16)',
  }[tone];
  const fg: keyof Palette = iconColor ?? (tone === 'primary' ? 'onPrimary' : tone === 'glass' ? 'onHero' : 'ink');

  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: tone === 'surface' ? 1 : 0,
        borderColor: colors.border,
      }}>
      <Icon name={icon} size={Math.round(size * 0.46)} color={fg} directional={directional} />
    </PressableScale>
  );
}
