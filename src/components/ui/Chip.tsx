import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type ChipProps = {
  label: string;
  selected?: boolean;
  icon?: IconName;
  onPress?: () => void;
};

export function Chip({ label, selected, icon, onPress }: ChipProps) {
  const { colors, radius } = useTheme();
  const { row } = useDirection();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={{
        flexDirection: row,
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
      }}>
      {icon ? <Icon name={icon} size={18} color={selected ? 'onPrimary' : 'inkMuted'} /> : null}
      <Text variant="label" color={selected ? 'onPrimary' : 'ink'}>
        {label}
      </Text>
    </PressableScale>
  );
}
