import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  large?: boolean;
};

/** In-screen header. Large variant for tab roots, compact with back button for pushed screens. */
export function ScreenHeader({ title, subtitle, back, right, large = !back }: Props) {
  const { spacing } = useTheme();
  const { row } = useDirection();
  const { t } = useTranslation();

  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.md }}>
      {back || right ? (
        <View style={{ flexDirection: row, alignItems: 'center', justifyContent: 'space-between' }}>
          {back ? (
            <IconButton icon="arrow-left" directional accessibilityLabel={t('common.back')} onPress={() => router.back()} />
          ) : (
            <View />
          )}
          {!large ? (
            <Text variant="title" numberOfLines={1} style={{ flex: 1, marginHorizontal: spacing.md }} align="center">
              {title}
            </Text>
          ) : null}
          {right ?? <View style={{ width: 48 }} />}
        </View>
      ) : null}
      {large ? (
        <View style={{ gap: 4 }}>
          <Text variant="h1" accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="body" color="inkMuted">
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
