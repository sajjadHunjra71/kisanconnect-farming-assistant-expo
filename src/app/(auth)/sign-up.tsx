import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, PressableScale, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { AuthNotice, GoogleButton, OrDivider } from '@/features/auth/components';
import { StepDots } from '@/features/onboarding/components';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const next = () => router.push('/farm-setup');

  return (
    <Screen keyboard header={<ScreenHeader back title="" right={<StepDots current={2} total={3} />} large={false} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.signUpTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.signUpBody')}
        </Text>
      </View>
      <AuthNotice />
      <GoogleButton onPress={next} />
      <OrDivider />
      <View style={{ gap: spacing.lg }}>
        <TextField label={t('auth.name')} icon="account-outline" placeholder={t('auth.namePlaceholder')} autoComplete="name" value={form.name} onChangeText={set('name')} />
        <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={form.email} onChangeText={set('email')} />
        <TextField label={t('auth.password')} icon="lock-outline" password hint={t('auth.passwordHint')} autoComplete="new-password" value={form.password} onChangeText={set('password')} />
      </View>
      <Button label={t('auth.createAccount')} onPress={next} />
      <Text variant="caption" color="inkSubtle" align="center">
        {t('auth.terms')}
      </Text>
      <View style={{ flexDirection: row, justifyContent: 'center', gap: 6 }}>
        <Text variant="body" color="inkMuted">
          {t('auth.haveAccount')}
        </Text>
        <PressableScale onPress={() => router.replace('/sign-in')} accessibilityRole="link">
          <Text variant="bodyStrong" color="primary">
            {t('auth.signIn')}
          </Text>
        </PressableScale>
      </View>
    </Screen>
  );
}
