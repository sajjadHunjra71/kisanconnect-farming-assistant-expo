import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { AuthNotice } from '@/features/auth/components';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  return (
    <Screen keyboard header={<ScreenHeader back title="" large={false} />} footer={<Button label={t('auth.sendLink')} icon="email-fast-outline" onPress={() => router.back()} />}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-reset" size={30} color="primary" />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.resetTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.resetBody')}
        </Text>
      </View>
      <AuthNotice />
      <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
    </Screen>
  );
}
