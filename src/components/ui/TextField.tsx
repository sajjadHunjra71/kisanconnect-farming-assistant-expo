import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/typography';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  icon?: IconName;
  error?: string;
  hint?: string;
  password?: boolean;
};

export function TextField({ label, icon, error, hint, password, ...input }: Props) {
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(!!password);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label" color="inkMuted">
        {label}
      </Text>
      <View
        style={{
          flexDirection: row,
          alignItems: 'center',
          gap: spacing.sm,
          minHeight: 56,
          paddingHorizontal: spacing.lg,
          borderRadius: radius.md,
          borderWidth: focused ? 2 : 1,
          borderColor,
          backgroundColor: colors.surface,
        }}>
        {icon ? <Icon name={icon} size={20} color={focused ? 'primary' : 'inkSubtle'} /> : null}
        <TextInput
          {...input}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          placeholderTextColor={colors.inkSubtle}
          onFocus={(e) => {
            setFocused(true);
            input.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            input.onBlur?.(e);
          }}
          style={{
            flex: 1,
            color: colors.ink,
            fontFamily: isRTL ? fontFamilies.urdu : fontFamilies.medium,
            fontSize: 16,
            textAlign: isRTL ? 'right' : 'left',
            paddingVertical: 12,
          }}
        />
        {password ? (
          <PressableScale onPress={() => setHidden((h) => !h)} accessibilityRole="button" accessibilityLabel="Toggle password visibility" hitSlop={10}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color="inkSubtle" />
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="inkSubtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
