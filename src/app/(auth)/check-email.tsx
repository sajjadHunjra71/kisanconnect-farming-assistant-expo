import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, Screen, Text } from '@/components/ui';
import { useTheme } from '@/theme';

export default function CheckEmailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { email = '', kind } = useLocalSearchParams<{ email?: string; kind?: 'confirm' | 'reset' }>();

  return (
    <Screen scroll={false} footer={<Button label={t('auth.backToSignIn')} variant="secondary" onPress={() => router.replace('/sign-in')} />} contentStyle={{ justifyContent: 'center' }}>
      <View style={{ alignItems: 'center', gap: spacing.lg }}>
        <View style={{ width: 88, height: 88, borderRadius: 30, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="email-check-outline" size={42} color="warning" />
        </View>
        <Text variant="h1" align="center">
          {t('auth.checkEmailTitle')}
        </Text>
        <Text variant="body" color="inkMuted" align="center">
          {kind === 'reset' ? t('auth.resetSentBody', { email }) : t('auth.checkEmailBody', { email })}
        </Text>
      </View>
    </Screen>
  );
}
