import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, FormError, Icon, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { isBackendConfigured } from '@/config/env';
import { sendPasswordReset } from '@/features/auth/auth-service';
import { AuthNotice } from '@/features/auth/components';
import { useAuthAction } from '@/features/auth/use-auth-action';
import { resetSchema, validate } from '@/features/auth/validation';
import { useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const { run, loading, error } = useAuthAction();

  const submit = async () => {
    if (!isBackendConfigured) return router.back();
    const v = validate(resetSchema, { email });
    if (!v.ok) return setFieldError(t(`auth.errors.${v.errors.email}` as 'auth.errors.unknown'));
    setFieldError(undefined);
    const done = await run(async () => {
      await sendPasswordReset(v.data.email);
      return true;
    });
    if (done) router.replace({ pathname: '/check-email', params: { email: v.data.email, kind: 'reset' } });
  };

  return (
    <Screen keyboard header={<ScreenHeader back title="" large={false} />} footer={<Button label={t('auth.sendLink')} icon="email-fast-outline" onPress={submit} loading={loading} />}>
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
      <FormError message={error} />
      <TextField label={t('auth.email')} icon="email-outline" placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" value={email} onChangeText={setEmail} error={fieldError} onSubmitEditing={submit} />
    </Screen>
  );
}
