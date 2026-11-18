import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button, Icon, Text } from '@/components/ui';
import { FieldIllustration } from '@/features/onboarding/components';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl, overflow: 'hidden' }}>
        <FieldIllustration height={360 + insets.top} />
        <View style={{ position: 'absolute', top: insets.top + spacing.lg, left: spacing.xl, right: spacing.xl, flexDirection: row, alignItems: 'center', gap: 8 }}>
          <View style={{ width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sprout" size={22} tint="#FFFFFF" />
          </View>
          <Text variant="title" latin style={{ color: '#FFFFFF' }}>
            KisanConnect
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.xxl, paddingBottom: insets.bottom + spacing.lg, justifyContent: 'space-between' }}>
        <Animated.View entering={FadeInDown.duration(500).delay(100)} style={{ gap: spacing.md }}>
          <Text variant="h1">{t('onboarding.welcomeTitle')}</Text>
          <Text variant="body" color="inkMuted">
            {t('onboarding.welcomeBody')}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(500).delay(250)} style={{ gap: spacing.sm }}>
          <Button label={t('onboarding.getStarted')} icon="arrow-right" iconPosition="end" onPress={() => router.push('/language')} />
          <Button label={t('onboarding.haveAccount')} variant="ghost" onPress={() => router.push('/sign-in')} />
        </Animated.View>
      </View>
    </View>
  );
}
