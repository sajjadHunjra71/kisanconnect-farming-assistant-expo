import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { exchangeCode } from '@/features/auth/auth-service';
import { goAfterAuth } from '@/features/auth/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

/** Deep link target for email confirmation and Google redirects: kisanconnect://auth/callback?code=… */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // The Google flow may already have exchanged this code inside the auth browser.
    if (useAuthStore.getState().status === 'signedIn') return goAfterAuth();
    if (!code) return setFailed(true);
    exchangeCode(code).then(goAfterAuth, () => {
      if (useAuthStore.getState().status === 'signedIn') goAfterAuth();
      else setFailed(true);
    });
  }, [code]);

  return (
    <Screen
      scroll={false}
      contentStyle={{ justifyContent: 'center' }}
      footer={failed ? <Button label={t('auth.backToSignIn')} variant="secondary" onPress={() => router.replace('/sign-in')} /> : undefined}>
      <View style={{ alignItems: 'center', gap: spacing.lg }}>
        {failed ? null : <ActivityIndicator size="large" color={colors.primary} />}
        <Text variant="body" color="inkMuted" align="center">
          {failed ? t('auth.linkFailed') : t('auth.finishing')}
        </Text>
      </View>
    </Screen>
  );
}
