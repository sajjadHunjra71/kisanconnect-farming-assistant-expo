import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Chip, Screen, ScreenHeader, SegmentedControl, Text } from '@/components/ui';
import { CropPicker } from '@/features/farm/components';
import { StepDots } from '@/features/onboarding/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { PRIMARY_CROPS } from '@/mocks/crops';
import { PUNJAB_DISTRICTS } from '@/mocks/sample-data';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';
import type { CropId } from '@/types/domain';

type Sowing = 'week' | 'month' | 'twoMonths' | 'notYet';

export default function FarmSetupScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const [district, setDistrict] = useState('Faisalabad');
  const [crop, setCrop] = useState<CropId>('wheat');
  const [sowing, setSowing] = useState<Sowing>('month');

  const finish = () => {
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <Screen
      header={<ScreenHeader back title="" right={<StepDots current={3} total={3} />} large={false} />}
      footer={<Button label={t('onboarding.finish')} icon="check" onPress={finish} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('onboarding.farmTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('onboarding.farmBody')}
        </Text>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="title">{t('onboarding.district')}</Text>
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
          {PUNJAB_DISTRICTS.map((d) => (
            <Chip key={d.en} label={l(d)} selected={district === d.en} onPress={() => setDistrict(d.en)} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="title">{t('onboarding.crop')}</Text>
        <CropPicker crops={PRIMARY_CROPS} value={crop} onChange={setCrop} />
      </View>

      <View style={{ gap: spacing.md }}>
        <Text variant="title">{t('onboarding.sowing')}</Text>
        <View style={{ gap: spacing.sm }}>
          <SegmentedControl<Sowing>
            value={sowing}
            onChange={setSowing}
            options={[
              { value: 'week', label: t('onboarding.sowingOptions.week') },
              { value: 'month', label: t('onboarding.sowingOptions.month') },
            ]}
          />
          <SegmentedControl<Sowing>
            value={sowing}
            onChange={setSowing}
            options={[
              { value: 'twoMonths', label: t('onboarding.sowingOptions.twoMonths') },
              { value: 'notYet', label: t('onboarding.sowingOptions.notYet') },
            ]}
          />
        </View>
      </View>
    </Screen>
  );
}
