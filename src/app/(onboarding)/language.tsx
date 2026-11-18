import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Screen, ScreenHeader, Text } from '@/components/ui';
import { StepDots } from '@/features/onboarding/components';
import { LanguagePicker } from '@/features/settings/components';

export default function LanguageScreen() {
  const { t } = useTranslation();
  return (
    <Screen
      header={<ScreenHeader back title="" right={<StepDots current={1} total={3} />} large={false} />}
      footer={<Button label={t('common.continue')} icon="arrow-right" iconPosition="end" onPress={() => router.push('/sign-up')} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('onboarding.languageTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('onboarding.languageBody')}
        </Text>
      </View>
      <LanguagePicker />
    </Screen>
  );
}
