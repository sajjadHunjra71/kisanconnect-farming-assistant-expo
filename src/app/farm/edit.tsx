import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Button, Card, Chip, Divider, FormError, ListRow, Screen, ScreenHeader, SegmentedControl, Text, TextField } from '@/components/ui';
import { ValidationError, type FarmInput, type LocationSource, type SoilType, SOIL_TYPES } from '@/db';
import { AREA_UNITS, PUNJAB_DISTRICTS, matchDistrict, searchDistricts, type AreaUnit, type District } from '@/engine';
import { useRepos } from '@/features/farm/hooks';
import { useDirection } from '@/hooks/use-direction';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

type Errors = Partial<Record<string, string>>;
type Loc = { district: string | null; lat: number | null; lng: number | null; source: LocationSource | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

export default function FarmEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { row } = useDirection();
  const repos = useRepos();
  const language = useSettingsStore((s) => s.language);
  const fallbackUnit = useSettingsStore((s) => s.units);
  const profileUnit = useAuthStore((s) => s.profile?.units);
  const setSelectedFarmId = useSettingsStore((s) => s.setSelectedFarmId);

  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [unit, setUnit] = useState<AreaUnit>(profileUnit ?? fallbackUnit);
  const [loc, setLoc] = useState<Loc>({ district: null, lat: null, lng: null, source: null });
  const [soil, setSoil] = useState<SoilType | null>(null);
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [locMessage, setLocMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!repos || !id) return;
    void repos.farmsRepo.get(id).then((f) => {
      if (!f) return;
      setName(f.name);
      setArea(String(f.area_value));
      setUnit(f.area_unit);
      setLoc({ district: f.district, lat: f.lat, lng: f.lng, source: f.location_source });
      setSoil(f.soil_type);
      setNotes(f.notes ?? '');
    });
  }, [repos, id]);

  const districts = useMemo(() => searchDistricts(query), [query]);
  const label = (d: District) => (language === 'ur' ? d.ur : d.en);
  const currentDistrict = PUNJAB_DISTRICTS.find((d) => d.en === loc.district);

  const pickDistrict = (d: District) => {
    setLoc({ district: d.en, lat: d.lat, lng: d.lng, source: 'district' });
    setPickerOpen(false);
    setQuery('');
    setLocMessage(null);
  };

  const locateMe = async () => {
    setLocating(true);
    setLocMessage(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLocMessage(t('farm.form.locationDenied'));
        setPickerOpen(true);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = round2(pos.coords.latitude);
      const lng = round2(pos.coords.longitude);
      const [place] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }).catch(() => []);
      const d = matchDistrict(place ?? {}, { lat, lng });
      if (!d) {
        setLocMessage(t('farm.form.outsidePunjab'));
        setPickerOpen(true);
        return;
      }
      setLoc({ district: d.en, lat, lng, source: 'gps' });
      setPickerOpen(false);
    } catch {
      setLocMessage(t('farm.form.locationFailed'));
      setPickerOpen(true);
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    if (!repos) return;
    const input: FarmInput = {
      name,
      area_value: area.trim() === '' ? (undefined as unknown as number) : Number(area.replace(',', '.')),
      area_unit: unit,
      district: loc.district,
      lat: loc.lat,
      lng: loc.lng,
      location_source: loc.source,
      soil_type: soil,
      notes,
    };
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const farm = id ? await repos.farmsRepo.update(id, input) : await repos.farmsRepo.create(input);
      setSelectedFarmId(farm.id);
      router.back();
    } catch (e) {
      if (e instanceof ValidationError) {
        const key = `farm.form.errors.${e.field}`;
        setErrors({ [e.field]: t(key, { defaultValue: t('farm.form.errors.generic') }) });
      } else {
        setFormError(t('farm.form.errors.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(t('farm.form.deleteTitle'), t('farm.form.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('farm.form.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          if (!repos || !id) return;
          await repos.farmsRepo.remove(id);
          setSelectedFarmId(null);
          router.back();
        },
      },
    ]);

  return (
    <Screen
      keyboard
      header={<ScreenHeader back title={id ? t('farm.editFarm') : t('farm.addFarm')} large={false} />}
      footer={<Button label={t('farm.form.save')} icon="check" onPress={() => void save()} loading={saving} disabled={!repos} />}>
      <FormError message={formError} />
      <TextField label={t('farm.form.name')} placeholder={t('farm.form.namePlaceholder')} value={name} onChangeText={setName} maxLength={60} error={errors.name} />

      <View style={{ gap: spacing.sm }}>
        <TextField
          label={t('farm.form.area')}
          placeholder={t('farm.form.areaPlaceholder')}
          value={area}
          onChangeText={setArea}
          keyboardType="decimal-pad"
          error={errors.area_value}
        />
        <SegmentedControl<AreaUnit> value={unit} onChange={setUnit} options={AREA_UNITS.map((u) => ({ value: u, label: t(`farm.unitNames.${u}`) }))} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('farm.form.location')}</Text>
        {currentDistrict && !pickerOpen ? (
          <Card style={{ paddingVertical: spacing.xs }}>
            <ListRow
              icon={loc.source === 'gps' ? 'crosshairs-gps' : 'map-marker-outline'}
              iconTone="primarySoft"
              title={label(currentDistrict)}
              subtitle={loc.source === 'gps' ? t('farm.form.fromGps') : t('farm.form.fromDistrict')}
              trailing={<Button label={t('farm.form.changeDistrict')} variant="ghost" size="md" fullWidth={false} onPress={() => setPickerOpen(true)} />}
              chevron={false}
            />
          </Card>
        ) : null}
        {locMessage ? (
          <Text variant="caption" color="warning">
            {locMessage}
          </Text>
        ) : null}
        <View style={{ flexDirection: row, gap: spacing.sm }}>
          <Button
            label={locating ? t('farm.form.locating') : t('farm.form.useLocation')}
            icon="crosshairs-gps"
            variant="secondary"
            onPress={() => void locateMe()}
            disabled={locating}
            style={{ flex: 1 }}
          />
          <Button label={t('farm.form.pickDistrict')} icon="format-list-bulleted" variant="secondary" onPress={() => setPickerOpen((o) => !o)} style={{ flex: 1 }} />
        </View>
        {locating ? <ActivityIndicator color={colors.primary} /> : null}
        {pickerOpen ? (
          <Card style={{ gap: spacing.sm }}>
            <TextField label={t('farm.form.searchDistrict')} icon="magnify" value={query} onChangeText={setQuery} autoCorrect={false} />
            {districts.length === 0 ? (
              <Text variant="caption" color="inkMuted">
                {t('farm.form.noMatch')}
              </Text>
            ) : (
              districts.map((d, i) => (
                <View key={d.key}>
                  {i > 0 ? <Divider /> : null}
                  <ListRow title={label(d)} onPress={() => pickDistrict(d)} chevron={false} trailing={d.en === loc.district ? <Text color="primary">✓</Text> : undefined} />
                </View>
              ))
            )}
          </Card>
        ) : null}
        {errors.district || errors.lat || errors.lng ? (
          <Text variant="caption" color="danger">
            {errors.district ?? errors.lat ?? errors.lng}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('farm.form.soil')}</Text>
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
          {SOIL_TYPES.map((s) => (
            <Chip key={s} label={t(`farm.soilTypes.${s}`)} selected={soil === s} onPress={() => setSoil(soil === s ? null : s)} />
          ))}
        </View>
      </View>

      <TextField
        label={t('farm.form.notes')}
        placeholder={t('farm.form.notesPlaceholder')}
        value={notes}
        onChangeText={setNotes}
        multiline
        maxLength={500}
        error={errors.notes}
      />

      {id ? <Button label={t('farm.form.delete')} icon="delete-outline" variant="danger" onPress={confirmDelete} /> : null}
    </Screen>
  );
}
