import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, FormError, Icon, Screen, Text, TextField } from '@/components/ui';
import { exchangeCode, updatePassword } from '@/features/auth/auth-service';
import { goAfterAuth } from '@/features/auth/navigation';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { newPasswordSchema, validate } from '@/features/auth/validation';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

type Stage = 'exchanging' | 'form' | 'failed';

/** Deep link target for password reset emails: kisanconnect://auth/reset?code=… */
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [stage, setStage] = useState<Stage>('exchanging');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, loading, error } = useAuthAction();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) return setStage(useAuthStore.getState().status === 'signedIn' ? 'form' : 'failed');
    exchangeCode(code).then(
      () => setStage('form'),
      () => setStage('failed'),
    );
  }, [code]);

  const submit = async () => {
    const v = validate(newPasswordSchema, { password, confirm });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    const done = await run(async () => {
      await updatePassword(v.data.password);
      return true;
    });
    if (done) goAfterAuth();
  };

  const fieldError = (key: string) => (errors[key] ? t(`auth.errors.${errors[key]}` as 'auth.errors.unknown') : undefined);

  if (stage !== 'form') {
    return (
      <Screen
        scroll={false}
        contentStyle={{ justifyContent: 'center' }}
        footer={stage === 'failed' ? <Button label={t('auth.backToSignIn')} variant="secondary" onPress={() => router.replace('/sign-in')} /> : undefined}>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          {stage === 'exchanging' ? <ActivityIndicator size="large" color={colors.primary} /> : null}
          <Text variant="body" color="inkMuted" align="center">
            {stage === 'failed' ? t('auth.linkFailed') : t('auth.finishing')}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen keyboard footer={<Button label={t('auth.savePassword')} icon="check" onPress={submit} loading={loading} />}>
      <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock-check-outline" size={30} color="primary" />
      </View>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('auth.newPasswordTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('auth.newPasswordBody')}
        </Text>
      </View>
      <FormError message={error} />
      <TextField label={t('auth.newPassword')} icon="lock-outline" password autoComplete="new-password" value={password} onChangeText={setPassword} error={fieldError('password')} hint={t('auth.passwordHint')} />
      <TextField label={t('auth.confirmPassword')} icon="lock-outline" password autoComplete="new-password" value={confirm} onChangeText={setConfirm} error={fieldError('confirm')} onSubmitEditing={submit} />
    </Screen>
  );
}
