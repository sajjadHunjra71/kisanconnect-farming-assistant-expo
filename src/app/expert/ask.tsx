import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, View } from 'react-native';

import { Button, Icon, PressableScale, Screen, ScreenHeader, Text, type IconName } from '@/components/ui';
import { CropPicker } from '@/features/farm/components';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/typography';
import type { CropId } from '@/types/domain';

export default function AskExpertScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const [crop, setCrop] = useState<CropId>('wheat');
  const [text, setText] = useState('');

  const attach: { icon: IconName; label: string }[] = [
    { icon: 'camera-plus-outline', label: t('expert.addPhoto') },
    { icon: 'microphone-plus', label: t('expert.addVoice') },
  ];

  return (
    <Screen keyboard header={<ScreenHeader back title={t('expert.newQuestion')} large={false} />} footer={<Button label={t('expert.submit')} icon="send" onPress={() => router.back()} />}>
      <Text variant="h2">{t('expert.askTitle')}</Text>
      <CropPicker crops={['wheat', 'rice', 'cotton', 'sugarcane', 'maize']} value={crop} onChange={setCrop} />
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder={t('expert.askPlaceholder')}
        placeholderTextColor={colors.inkSubtle}
        accessibilityLabel={t('expert.askPlaceholder')}
        style={{
          minHeight: 140,
          padding: spacing.lg,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.ink,
          fontFamily: isRTL ? fontFamilies.urdu : fontFamilies.regular,
          fontSize: 16,
          textAlign: isRTL ? 'right' : 'left',
          textAlignVertical: 'top',
        }}
      />
      <View style={{ flexDirection: row, gap: spacing.sm }}>
        {attach.map((a) => (
          <PressableScale
            key={a.icon}
            accessibilityRole="button"
            accessibilityLabel={a.label}
            style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.surface }}>
            <Icon name={a.icon} size={28} color="primary" />
            <Text variant="label" align="center">
              {a.label}
            </Text>
          </PressableScale>
        ))}
      </View>
    </Screen>
  );
}
