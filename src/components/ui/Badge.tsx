import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'danger' | 'warning' | 'info' | 'success';

type BadgeProps = { label: string; tone?: BadgeTone; icon?: IconName };

export function Badge({ label, tone = 'neutral', icon }: BadgeProps) {
  const { colors, radius } = useTheme();
  const { row } = useDirection();
  const map = {
    neutral: [colors.surfaceAlt, colors.inkMuted],
    primary: [colors.primarySoft, colors.primary],
    accent: [colors.accentSoft, colors.warning],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
    info: [colors.infoSoft, colors.info],
    success: [colors.successSoft, colors.success],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={{
        flexDirection: row,
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}>
      {icon ? <Icon name={icon} size={13} tint={fg} /> : null}
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}
