import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { Button, Chip, FormError, Screen, ScreenHeader, Text, TextField } from '@/components/ui';
import { ACTIVITY_TYPES, ValidationError, type ActivityInput, type ActivityType, type CropRecord } from '@/db';
import { CROP_CALENDARS, QUANTITY_UNITS, addDays, todayLocal, type QuantityUnit } from '@/engine';
import { ACTIVITY_META } from '@/features/activity/meta';
import { DateField } from '@/features/farm/components';
import { useRepos } from '@/features/farm/hooks';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

type Errors = Partial<Record<string, string>>;
const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

export default function ActivityEditScreen() {
  const params = useLocalSearchParams<{ id?: string; farmId?: string; cropId?: string; type?: ActivityType }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const repos = useRepos();
  const selectedFarmId = useSettingsStore((s) => s.selectedFarmId);

  const [farmId, setFarmId] = useState<string | null>(params.farmId ?? null);
  const [crops, setCrops] = useState<CropRecord[]>([]);
  const [type, setType] = useState<ActivityType>(params.type ?? 'irrigation');
  const [cropId, setCropId] = useState<string | null>(params.cropId ?? null);
  const [date, setDate] = useState(todayLocal());
  const [qty, setQty] = useState('');
  const [unit, setUnit] = useState<QuantityUnit | null>(null);
  const [product, setProduct] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editing: load the activity. New: farm from params, the crop's farm, or the selected farm.
  useEffect(() => {
    if (!repos) return;
    void (async () => {
      if (params.id) {
        const a = await repos.activitiesRepo.get(params.id);
        if (!a) return;
        setFarmId(a.farm_id);
        setType(a.type);
        setCropId(a.crop_id);
        setDate(a.done_on);
        setQty(a.quantity != null ? String(a.quantity) : '');
        setUnit(a.quantity_unit);
        setProduct(a.product ?? '');
        setCost(a.cost_pkr != null ? String(a.cost_pkr) : '');
        setNotes(a.notes ?? '');
        return;
      }
      if (params.farmId) return;
      if (params.cropId) {
        const c = await repos.cropsRepo.get(params.cropId);
        if (c) return setFarmId(c.farm_id);
      }
      const farms = (await repos.farmsRepo.list()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      setFarmId((farms.find((f) => f.id === selectedFarmId) ?? farms[0])?.id ?? null);
    })();
  }, [repos, params.id, params.farmId, params.cropId, selectedFarmId]);

  useEffect(() => {
    if (!repos || !farmId) return;
    void repos.cropsRepo.list({ farmId }).then((cs) => setCrops(cs.filter((c) => c.status === 'active' || c.id === cropId)));
  }, [repos, farmId, cropId]);

  const save = async () => {
    if (!repos || !farmId) return;
    const input: ActivityInput = {
      farm_id: farmId,
      crop_id: cropId,
      type,
      done_on: date,
      quantity: num(qty),
      quantity_unit: num(qty) === null ? null : unit,
      product,
      cost_pkr: num(cost),
      notes,
    };
    const crop = crops.find((c) => c.id === cropId);
    let markCropHarvested = false;
    if (!params.id && type === 'harvest' && crop?.status === 'active') {
      markCropHarvested = await new Promise<boolean>((resolve) =>
        Alert.alert(t('activity.harvestTitle'), t('activity.harvestBody'), [
          { text: t('activity.harvestNo'), onPress: () => resolve(false) },
          { text: t('activity.harvestYes'), onPress: () => resolve(true) },
        ], { onDismiss: () => resolve(false) }),
      );
    }
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      if (params.id) await repos.activitiesRepo.update(params.id, input);
      else await repos.logActivity(input, { markCropHarvested });
      router.back();
    } catch (e) {
      if (e instanceof ValidationError) setErrors({ [e.field]: t(`activity.errors.${e.field}`, { defaultValue: t('activity.errors.generic') }) });
      else setFormError(t('activity.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('activity.deleteTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('activity.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          if (!repos || !params.id) return;
          await repos.activitiesRepo.remove(params.id);
          router.back();
        },
      },
    ]);

  const chipRow = { flexDirection: row, flexWrap: 'wrap' as const, gap: spacing.sm };

  return (
    <Screen
      keyboard
      header={<ScreenHeader back title={params.id ? t('activity.edit') : t('activity.log')} large={false} />}
      footer={farmId ? <Button label={t('activity.save')} icon="check" onPress={() => void save()} loading={saving} disabled={!repos} /> : undefined}>
      {repos && !farmId ? (
        <Text variant="body" color="inkMuted">
          {t('activity.noFarm')}
        </Text>
      ) : null}
      <FormError message={formError ?? errors.farm_id ?? errors.crop_id ?? errors.harvested_on ?? null} />

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('activity.type')}</Text>
        <View style={chipRow}>
          {ACTIVITY_TYPES.map((k) => (
            <Chip key={k} label={t(`activity.types.${k}`)} icon={ACTIVITY_META[k].icon} selected={type === k} onPress={() => setType(k)} />
          ))}
        </View>
      </View>

      {crops.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">{t('activity.crop')}</Text>
          <View style={chipRow}>
            <Chip label={t('activity.wholeFarm')} icon="barn" selected={cropId === null} onPress={() => setCropId(null)} />
            {crops.map((c) => (
              <Chip key={c.id} label={[l(CROP_CALENDARS[c.crop_key].name), c.variety].filter(Boolean).join(' · ')} selected={cropId === c.id} onPress={() => setCropId(c.id)} />
            ))}
          </View>
        </View>
      ) : null}

      <DateField label={t('activity.date')} value={date} onChange={setDate} max={todayLocal()} min={addDays(todayLocal(), -730)} error={errors.done_on} />

      <View style={{ gap: spacing.sm }}>
        <TextField label={t('activity.quantity')} placeholder={t('activity.quantityPlaceholder')} value={qty} onChangeText={setQty} keyboardType="decimal-pad" error={errors.quantity} />
        {qty.trim() ? (
          <View style={chipRow}>
            {QUANTITY_UNITS.map((u) => (
              <Chip key={u} label={t(`activity.units.${u}`)} selected={unit === u} onPress={() => setUnit(u)} />
            ))}
          </View>
        ) : null}
        {errors.quantity_unit ? (
          <Text variant="caption" color="danger">
            {errors.quantity_unit}
          </Text>
        ) : null}
      </View>

      <TextField label={t('activity.product')} placeholder={t('activity.productPlaceholder')} value={product} onChangeText={setProduct} maxLength={80} error={errors.product} />
      <TextField label={t('activity.costLabel')} placeholder={t('activity.costPlaceholder')} value={cost} onChangeText={setCost} keyboardType="decimal-pad" error={errors.cost_pkr} />
      <TextField label={t('activity.notes')} value={notes} onChangeText={setNotes} multiline maxLength={500} error={errors.notes} />

      {params.id ? <Button label={t('activity.delete')} icon="delete-outline" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
