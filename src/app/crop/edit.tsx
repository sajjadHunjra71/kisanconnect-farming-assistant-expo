import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Chip, FormError, Screen, ScreenHeader, SegmentedControl, Text, TextField } from '@/components/ui';
import { ValidationError, type CropRecord, type FarmRecord } from '@/db';
import { AREA_UNITS, CROP_CALENDARS, PRIMARY_CROPS, addDays, roundArea, toAcres, todayLocal, type AreaUnit, type CropId } from '@/engine';
import { CropPicker, DateField } from '@/features/farm/components';
import { useRepos } from '@/features/farm/hooks';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type Errors = Partial<Record<string, string>>;

export default function CropEditScreen() {
  const params = useLocalSearchParams<{ id?: string; farmId?: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const repos = useRepos();

  const [farmId, setFarmId] = useState(params.farmId ?? '');
  const [cropKey, setCropKey] = useState<CropId>('wheat');
  const [variety, setVariety] = useState<string | null>(null);
  const [otherVariety, setOtherVariety] = useState('');
  const [isOther, setIsOther] = useState(false);
  const [sowing, setSowing] = useState(todayLocal());
  const [area, setArea] = useState('');
  const [unit, setUnit] = useState<AreaUnit>('acre');
  const [farm, setFarm] = useState<FarmRecord | null>(null);
  const [siblings, setSiblings] = useState<CropRecord[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!repos || !params.id) return;
    void repos.cropsRepo.get(params.id).then((c) => {
      if (!c) return;
      setFarmId(c.farm_id);
      setCropKey(c.crop_key);
      const known = c.variety && CROP_CALENDARS[c.crop_key].varieties.includes(c.variety);
      setVariety(known ? c.variety : null);
      setIsOther(!!c.variety && !known);
      setOtherVariety(known ? '' : (c.variety ?? ''));
      setSowing(c.sowing_date);
      setArea(c.area_value != null ? String(c.area_value) : '');
      if (c.area_unit) setUnit(c.area_unit);
    });
  }, [repos, params.id]);

  useEffect(() => {
    if (!repos || !farmId) return;
    void repos.farmsRepo.get(farmId).then((f) => {
      setFarm(f);
      if (f && !params.id) setUnit(f.area_unit);
    });
    void repos.cropsRepo.list({ farmId }).then(setSiblings);
  }, [repos, farmId, params.id]);

  const today = todayLocal();
  const minDate = addDays(today, -(CROP_CALENDARS[cropKey].seasonDays + 180));
  const maxDate = addDays(today, 30);

  const areaValue = area.trim() ? Number(area.replace(',', '.')) : null;
  const areaWarning = useMemo(() => {
    if (!farm || !areaValue || !(areaValue > 0)) return null;
    const used = siblings.filter((c) => c.status === 'active' && c.id !== params.id).reduce((sum, c) => sum + (c.area_acres ?? 0), 0) + toAcres(areaValue, unit);
    return used > farm.area_acres + 1e-6 ? t('crop.areaWarning', { used: roundArea(used, 2), total: roundArea(farm.area_acres, 2) }) : null;
  }, [farm, siblings, areaValue, unit, params.id, t]);

  const pickCrop = (id: CropId) => {
    setCropKey(id);
    setVariety(null);
  };

  const save = async () => {
    if (!repos) return;
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const input = {
        farm_id: farmId,
        crop_key: cropKey,
        variety: isOther ? otherVariety : variety,
        sowing_date: sowing,
        area_value: areaValue === null ? null : areaValue,
        area_unit: areaValue === null ? null : unit,
      };
      const crop = params.id ? await repos.cropsRepo.update(params.id, input) : await repos.cropsRepo.create(input);
      if (params.id) router.back();
      else router.replace({ pathname: '/crop/[id]', params: { id: crop.id } });
    } catch (e) {
      if (e instanceof ValidationError) setErrors({ [e.field]: t(`crop.errors.${e.field}`, { defaultValue: t('crop.errors.generic') }) });
      else setFormError(t('crop.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      keyboard
      header={<ScreenHeader back title={params.id ? t('crop.editCrop') : t('crop.addCrop')} large={false} />}
      footer={<Button label={t('crop.save')} icon="check" onPress={() => void save()} loading={saving} disabled={!repos || !farmId} />}>
      <FormError message={formError ?? errors.farm_id ?? null} />

      <View style={{ gap: spacing.md }}>
        <Text variant="title">{t('crop.crop')}</Text>
        <CropPicker crops={PRIMARY_CROPS} value={cropKey} onChange={pickCrop} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('crop.variety')}</Text>
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
          {CROP_CALENDARS[cropKey].varieties.map((v) => (
            <Chip
              key={v}
              label={v}
              selected={!isOther && variety === v}
              onPress={() => {
                setIsOther(false);
                setVariety(variety === v ? null : v);
              }}
            />
          ))}
          <Chip label={t('crop.varietyOther')} icon="pencil-outline" selected={isOther} onPress={() => setIsOther((o) => !o)} />
        </View>
        {isOther ? (
          <TextField label={t('crop.variety')} placeholder={t('crop.varietyPlaceholder')} value={otherVariety} onChangeText={setOtherVariety} maxLength={60} error={errors.variety} />
        ) : null}
      </View>

      <DateField label={t('crop.sowingDate')} value={sowing} onChange={setSowing} min={minDate} max={maxDate} error={errors.sowing_date} />

      <View style={{ gap: spacing.sm }}>
        <TextField
          label={t('crop.area')}
          placeholder={t('crop.areaPlaceholder')}
          value={area}
          onChangeText={setArea}
          keyboardType="decimal-pad"
          error={errors.area_value}
        />
        <SegmentedControl<AreaUnit> value={unit} onChange={setUnit} options={AREA_UNITS.map((u) => ({ value: u, label: t(`farm.unitNames.${u}`) }))} />
        {areaWarning ? (
          <Text variant="caption" color="warning">
            {areaWarning}
          </Text>
        ) : null}
      </View>

      <Text variant="caption" color="inkSubtle">
        {t('crop.indicative')}
      </Text>
    </Screen>
  );
}
