import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, PressableScale, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { AuthNotice, GoogleButton, OrDivider } from '@/features/auth/components';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

/** UI only. Supabase Auth (Google + email) is wired in Phase 1 once keys are in .env. */
export default function SignInScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row, alignEnd } = useDirection();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const next = () => router.push('/farm-setup');

  return (
    <Screen keyboard header={<ScreenHeader back title="" large={false} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.signInTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.signInBody')}
        </Text>
      </View>
      <AuthNotice />
      <GoogleButton onPress={next} />
      <OrDivider />
      <View style={{ gap: spacing.lg }}>
        <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} />
        <TextField label={t('auth.password')} icon="lock-outline" password autoComplete="password" value={password} onChangeText={setPassword} />
        <View style={{ alignItems: alignEnd }}>
          <PressableScale onPress={() => router.push('/forgot-password')} accessibilityRole="link" hitSlop={10}>
            <Text variant="label" color="primary">
              {t('auth.forgot')}
            </Text>
          </PressableScale>
        </View>
      </View>
      <Button label={t('auth.signIn')} onPress={next} />
      <View style={{ flexDirection: row, justifyContent: 'center', gap: 6 }}>
        <Text variant="body" color="inkMuted">
          {t('auth.noAccount')}
        </Text>
        <PressableScale onPress={() => router.replace('/sign-up')} accessibilityRole="link">
          <Text variant="bodyStrong" color="primary">
            {t('auth.createAccount')}
          </Text>
        </PressableScale>
      </View>
    </Screen>
  );
}
