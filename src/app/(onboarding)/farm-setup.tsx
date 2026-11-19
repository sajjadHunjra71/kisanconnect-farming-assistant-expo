import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Chip, FormError, Screen, ScreenHeader, SegmentedControl, Text, TextField } from '@/components/ui';
import { openRepos } from '@/db';
import { AREA_UNITS, addDays, districtByName, todayLocal, type AreaUnit } from '@/engine';
import { CropPicker } from '@/features/farm/components';
import { StepDots } from '@/features/onboarding/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { PRIMARY_CROPS } from '@/mocks/crops';
import { PUNJAB_DISTRICTS } from '@/mocks/sample-data';
import { useAuthStore } from '@/store/auth-store';
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
  const [farmName, setFarmName] = useState('');
  const [area, setArea] = useState('');
  const [unit, setUnit] = useState<AreaUnit>(useSettingsStore.getState().units);
  const [areaError, setAreaError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const userId = useAuthStore((s) => (s.status === 'signedIn' ? (s.session?.user.id ?? null) : null));
  const setSelectedFarmId = useSettingsStore((s) => s.setSelectedFarmId);

  /** Signed-in users get a real farm (and crop); demo mode keeps sample data. */
  const saveFarm = async (id: string) => {
    const areaValue = Number(area.replace(',', '.'));
    if (!(areaValue > 0)) {
      setAreaError(t('farm.form.errors.area_value'));
      return false;
    }
    const d = districtByName(district);
    const repos = await openRepos(id);
    const farm = await repos.farmsRepo.create({
      name: farmName.trim() || t('onboarding.defaultFarmName'),
      area_value: areaValue,
      area_unit: unit,
      district: d?.en ?? district,
      lat: d?.lat ?? null,
      lng: d?.lng ?? null,
      location_source: d ? 'district' : null,
    });
    const daysAgo = { week: 7, month: 30, twoMonths: 60, notYet: null }[sowing];
    if (daysAgo !== null) {
      await repos.cropsRepo.create({ farm_id: farm.id, crop_key: crop, sowing_date: addDays(todayLocal(), -daysAgo) });
    }
    setSelectedFarmId(farm.id);
    return true;
  };

  const finish = async () => {
    setAreaError(undefined);
    setSaveError(null);
    if (userId) {
      setSaving(true);
      try {
        if (!(await saveFarm(userId))) return;
      } catch {
        setSaveError(t('farm.form.errors.saveFailed'));
        return;
      } finally {
        setSaving(false);
      }
    }
    completeOnboarding();
    router.replace('/(tabs)');
  };

  return (
    <Screen
      header={<ScreenHeader back title="" right={<StepDots current={3} total={3} />} large={false} />}
      footer={<Button label={t('onboarding.finish')} icon="check" onPress={() => void finish()} loading={saving} />}>
      <View style={{ gap: 8 }}>
        <Text variant="h1">{t('onboarding.farmTitle')}</Text>
        <Text variant="body" color="inkMuted">
          {t('onboarding.farmBody')}
        </Text>
      </View>

      <FormError message={saveError} />
      <TextField label={t('onboarding.farmName')} placeholder={t('onboarding.defaultFarmName')} value={farmName} onChangeText={setFarmName} maxLength={60} />
      <View style={{ gap: spacing.sm }}>
        <TextField
          label={t('onboarding.area')}
          placeholder={t('farm.form.areaPlaceholder')}
          value={area}
          onChangeText={setArea}
          keyboardType="decimal-pad"
          error={areaError}
        />
        <SegmentedControl<AreaUnit> value={unit} onChange={setUnit} options={AREA_UNITS.map((u) => ({ value: u, label: t(`farm.unitNames.${u}`) }))} />
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
