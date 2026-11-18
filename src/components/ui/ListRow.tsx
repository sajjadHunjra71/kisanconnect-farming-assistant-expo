import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: keyof Pick<Palette, 'primarySoft' | 'accentSoft' | 'infoSoft' | 'dangerSoft' | 'surfaceAlt'>;
  trailing?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
};

export function ListRow({ title, subtitle, icon, iconTone = 'surfaceAlt', trailing, onPress, chevron = !!onPress, destructive }: Props) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();

  const content = (
    <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm }}>
      {icon ? (
        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors[iconTone], alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={destructive ? 'danger' : 'ink'} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" color={destructive ? 'danger' : 'ink'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color="inkMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevron-right" size={22} color="inkSubtle" directional /> : null}
    </View>
  );

  return onPress ? (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={title} scaleTo={0.985}>
      {content}
    </PressableScale>
  ) : (
    content
  );
}
