import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, FormError, PressableScale, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { isBackendConfigured } from '@/config/env';
import { signInWithEmail, signInWithGoogle } from '@/features/auth/auth-service';
import { AuthNotice, GoogleButton, OrDivider } from '@/features/auth/components';
import { SessionLossBanner } from '@/features/sync/components';
import { goAfterAuth } from '@/features/auth/navigation';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { signInSchema, validate } from '@/features/auth/validation';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export default function SignInScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row, alignEnd } = useDirection();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { run, loading, error } = useAuthAction();
  const google = useAuthAction();

  const submit = async () => {
    if (!isBackendConfigured) return goAfterAuth();
    const v = validate(signInSchema, { email, password });
    if (!v.ok) return setFieldErrors(v.errors);
    setFieldErrors({});
    const done = await run(async () => {
      await signInWithEmail(v.data.email, v.data.password);
      return true;
    });
    if (done) goAfterAuth();
  };

  const withGoogle = async () => {
    if (!isBackendConfigured) return goAfterAuth();
    const done = await google.run(async () => {
      await signInWithGoogle();
      return true;
    });
    if (done) goAfterAuth();
  };

  const fe = (k: string) => (fieldErrors[k] ? t(`auth.errors.${fieldErrors[k]}` as 'auth.errors.unknown') : undefined);

  return (
    <Screen keyboard header={<ScreenHeader back title="" large={false} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.signInTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.signInBody')}
        </Text>
      </View>
      <AuthNotice />
      <SessionLossBanner />
      <FormError message={error ?? google.error} />
      <GoogleButton onPress={withGoogle} loading={google.loading} />
      <OrDivider />
      <View style={{ gap: spacing.lg }}>
        <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" value={email} onChangeText={setEmail} error={fe('email')} />
        <TextField label={t('auth.password')} icon="lock-outline" password autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} error={fe('password')} onSubmitEditing={submit} />
        <View style={{ alignItems: alignEnd }}>
          <PressableScale onPress={() => router.push('/forgot-password')} accessibilityRole="link" hitSlop={10}>
            <Text variant="label" color="primary">
              {t('auth.forgot')}
            </Text>
          </PressableScale>
        </View>
      </View>
      <Button label={isBackendConfigured ? t('auth.signIn') : t('auth.continueDemo')} onPress={submit} loading={loading} />
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
