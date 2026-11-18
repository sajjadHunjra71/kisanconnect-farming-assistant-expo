import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, FormError, PressableScale, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { isBackendConfigured } from '@/config/env';
import { signInWithGoogle, signUpWithEmail } from '@/features/auth/auth-service';
import { AuthNotice, GoogleButton, OrDivider } from '@/features/auth/components';
import { goAfterAuth } from '@/features/auth/navigation';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { signUpSchema, validate } from '@/features/auth/validation';
import { StepDots } from '@/features/onboarding/components';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const { run, loading, error } = useAuthAction();
  const google = useAuthAction();

  const submit = async () => {
    if (!isBackendConfigured) return router.push('/farm-setup');
    const v = validate(signUpSchema, form);
    if (!v.ok) return setFieldErrors(v.errors);
    setFieldErrors({});
    const needsConfirm = await run(() => signUpWithEmail(v.data.name, v.data.email, v.data.password));
    if (needsConfirm === undefined) return;
    if (needsConfirm) router.replace({ pathname: '/check-email', params: { email: v.data.email, kind: 'confirm' } });
    else goAfterAuth();
  };

  const withGoogle = async () => {
    if (!isBackendConfigured) return router.push('/farm-setup');
    const done = await google.run(async () => {
      await signInWithGoogle();
      return true;
    });
    if (done) goAfterAuth();
  };

  const fe = (k: string) => (fieldErrors[k] ? t(`auth.errors.${fieldErrors[k]}` as 'auth.errors.unknown') : undefined);

  return (
    <Screen keyboard header={<ScreenHeader back title="" right={<StepDots current={2} total={3} />} large={false} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.signUpTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.signUpBody')}
        </Text>
      </View>
      <AuthNotice />
      <FormError message={error ?? google.error} />
      <GoogleButton onPress={withGoogle} loading={google.loading} />
      <OrDivider />
      <View style={{ gap: spacing.lg }}>
        <TextField label={t('auth.name')} icon="account-outline" placeholder={t('auth.namePlaceholder')} autoComplete="name" textContentType="name" value={form.name} onChangeText={set('name')} error={fe('name')} />
        <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" value={form.email} onChangeText={set('email')} error={fe('email')} />
        <TextField label={t('auth.password')} icon="lock-outline" password hint={t('auth.passwordHint')} autoComplete="new-password" textContentType="newPassword" value={form.password} onChangeText={set('password')} error={fe('password')} />
      </View>
      <Button label={isBackendConfigured ? t('auth.createAccount') : t('auth.continueDemo')} onPress={submit} loading={loading} />
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
