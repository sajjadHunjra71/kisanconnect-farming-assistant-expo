import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { Button, Card, Chip, Divider, Icon, ListRow, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text, type IconName } from '@/components/ui';
import type { CropRecord, FarmRecord } from '@/db';
import { CROP_CALENDARS, PRIMARY_CROPS, type CropId, type QualityResult } from '@/engine';
import { CropPicker } from '@/features/farm/components';
import { formatDate, localDay } from '@/features/farm/format';
import { useRepoQuery } from '@/features/farm/hooks';
import { pickLeafPhoto, photoQuality, prepareLeafPhoto } from '@/features/scan/photo';
import { hasAiConsent, newScanId, safeCreateScan } from '@/features/scan/scan-service';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

type Pending = { tempId: string; uri: string; quality: QualityResult };

export default function ScanScreen() {
  const params = useLocalSearchParams<{ cropId?: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const language = useSettingsStore((s) => s.language);
  const selectedFarmId = useSettingsStore((s) => s.selectedFarmId);
  const userId = useAuthStore((s) => (s.status === 'signedIn' ? (s.session?.user.id ?? null) : null));
  const profile = useAuthStore((s) => s.profile);

  const { data, repos, isSample } = useRepoQuery(
    async (r) => {
      const farms = (await r.farmsRepo.list()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const crops = (await r.cropsRepo.list()).filter((c) => c.status === 'active');
      const scans = (await r.scansRepo.list()).slice(0, 3);
      const states = await r.scanQueue.list();
      return { farms, crops, scans, states };
    },
    [],
  );

  const [farmId, setFarmId] = useState<string | null>(null);
  const [cropId, setCropId] = useState<string | null>(null);
  const [cropKey, setCropKey] = useState<CropId>('wheat');
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState<{ p: Pending; overridden: boolean } | null>(null);

  // Defaults: crop from the weather "Scan a leaf" link, else the selected farm's first active crop.
  useEffect(() => {
    if (!data) return;
    const fromLink = params.cropId ? data.crops.find((c) => c.id === params.cropId) : undefined;
    const farm = fromLink ? data.farms.find((f) => f.id === fromLink.farm_id) : (data.farms.find((f) => f.id === selectedFarmId) ?? data.farms[0]);
    setFarmId(farm?.id ?? null);
    const crop = fromLink ?? data.crops.find((c) => c.farm_id === farm?.id);
    setCropId(crop?.id ?? null);
    if (crop) setCropKey(crop.crop_key);
  }, [data, params.cropId, selectedFarmId]);

  const farmCrops: CropRecord[] = (data?.crops ?? []).filter((c) => c.farm_id === farmId);
  const owner = userId ?? 'demo';
  const cloudAllowed = isSample || hasAiConsent(profile);

  const take = async (source: 'camera' | 'library') => {
    setMessage(null);
    setFailed(null);
    try {
      const res = await pickLeafPhoto(source);
      if ('denied' in res) return setMessage(t('scan.permissionDenied'));
      if ('cancelled' in res) return;
      setBusy('photo');
      const tempId = newScanId();
      const prepared = await prepareLeafPhoto(res.uri, owner, tempId);
      const quality = await photoQuality(prepared.uri);
      if (quality.blocks.length > 0 || quality.warnings.length > 0) setPending({ tempId, uri: prepared.uri, quality });
      else await save({ tempId, uri: prepared.uri, quality }, false);
    } catch (e) {
      console.warn('[scan] photo failed:', e instanceof Error ? e.message : e);
      setMessage(t('scan.saveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const save = async (p: Pending, overridden: boolean) => {
    if (!repos) return;
    // First online check: explain and ask for consent (signed in, no consent yet).
    if (!isSample && userId && !hasAiConsent(useAuthStore.getState().profile)) {
      router.push({ pathname: '/scan/consent', params: { tempId: p.tempId, farmId: farmId ?? '', cropId: cropId ?? '', cropKey, quality: JSON.stringify({ ...p.quality, overridden }) } });
      setPending(null);
      return;
    }
    setBusy('save');
    setMessage(null);
    setFailed(null);
    try {
      const res = await safeCreateScan({
        repos,
        owner,
        tempId: p.tempId,
        photoUri: p.uri,
        farmId,
        cropId,
        cropKey,
        quality: { ...p.quality, overridden },
        cloudAllowed,
      });
      setPending(null);
      if ('error' in res) return setFailed({ p, overridden });
      void requestSync('full');
      router.push({ pathname: '/scan/[id]', params: { id: res.scan.id } });
    } finally {
      setBusy(null);
    }
  };

  const guide: { icon: IconName; text: string; good: boolean }[] = [
    { icon: 'leaf', text: t('scan.guideGood'), good: true },
    { icon: 'arrow-expand-all', text: t('scan.guideFar'), good: false },
    { icon: 'blur', text: t('scan.guideBlur'), good: false },
    { icon: 'weather-night', text: t('scan.guideDark'), good: false },
  ];

  const issueText = (i: string) => (i === 'blurry' ? t('scan.blurry') : i === 'dark' ? t('scan.dark') : t('scan.noLeaf'));

  return (
    <Screen withTabBar header={<ScreenHeader title={t('scan.title')} subtitle={t('scan.subtitle')} />}>
      {isSample ? <SampleDataNotice /> : null}

      {data && data.farms.length > 1 ? (
        <View style={{ gap: spacing.sm }}>
          <Text variant="title">{t('scan.farm')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: row, gap: spacing.sm }}>
            {data.farms.map((f: FarmRecord) => (
              <Chip
                key={f.id}
                label={f.name}
                icon="barn"
                selected={f.id === farmId}
                onPress={() => {
                  setFarmId(f.id);
                  const c = data.crops.find((x) => x.farm_id === f.id);
                  setCropId(c?.id ?? null);
                  if (c) setCropKey(c.crop_key);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="title">{t('scan.selectCrop')}</Text>
        {farmCrops.length > 0 ? (
          <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
            {farmCrops.map((c) => (
              <Chip
                key={c.id}
                label={[l(CROP_CALENDARS[c.crop_key].name), c.variety].filter(Boolean).join(' · ')}
                selected={c.id === cropId}
                onPress={() => {
                  setCropId(c.id);
                  setCropKey(c.crop_key);
                }}
              />
            ))}
            <Chip label={t('scan.otherCrop')} selected={cropId === null} onPress={() => setCropId(null)} />
          </View>
        ) : null}
        {cropId === null ? <CropPicker crops={PRIMARY_CROPS} value={cropKey} onChange={setCropKey} /> : null}
      </View>

      {pending ? (
        <Card tone={pending.quality.blocks.length ? 'dangerSoft' : 'warningSoft'} style={{ gap: spacing.sm }}>
          <Text variant="title">{t('scan.qualityTitle')}</Text>
          {[...pending.quality.blocks, ...pending.quality.warnings].map((i) => (
            <Text key={i} variant="body">
              {issueText(i)}
            </Text>
          ))}
          <Button label={t('scan.retake')} icon="camera-retake-outline" onPress={() => setPending(null)} />
          <Button label={t('scan.useAnyway')} variant="secondary" onPress={() => void save(pending, pending.quality.blocks.length > 0)} />
        </Card>
      ) : null}

      {failed ? (
        <Card tone="dangerSoft" style={{ gap: spacing.sm }}>
          <Text variant="body">{t('scan.saveFailed')}</Text>
          <Button label={t('scan.tryAgain')} icon="refresh" onPress={() => void save(failed.p, failed.overridden)} />
          <Button label={t('scan.retake')} icon="camera-retake-outline" variant="ghost" onPress={() => setFailed(null)} />
        </Card>
      ) : null}

      {message ? (
        <Text variant="body" color="danger">
          {message}
        </Text>
      ) : null}

      {busy ? (
        <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
          <ActivityIndicator />
          <Text variant="body" color="inkMuted">
            {busy === 'photo' ? t('scan.checkPhoto') : t('scan.saving')}
          </Text>
        </View>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Button label={t('scan.takePhoto')} icon="camera-outline" onPress={() => void take('camera')} disabled={!repos} />
          <Button label={t('scan.gallery')} icon="image-outline" variant="secondary" onPress={() => void take('library')} disabled={!repos} />
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t('scan.guideTitle')} />
        <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
          {guide.map((g) => (
            <Card key={g.text} tone={g.good ? 'successSoft' : 'surfaceAlt'} style={{ width: '48%', gap: spacing.xs, alignItems: 'center' }}>
              <Icon name={g.icon} size={32} color={g.good ? 'success' : 'inkMuted'} />
              <View style={{ flexDirection: row, alignItems: 'center', gap: 4 }}>
                <Icon name={g.good ? 'check-circle' : 'close-circle'} size={16} color={g.good ? 'success' : 'danger'} />
                <Text variant="caption" align="center" style={{ flexShrink: 1 }}>
                  {g.text}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t('scan.recent')} actionLabel={t('scan.history')} onAction={() => router.push('/scan/history')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {(data?.scans ?? []).length === 0 ? (
            <Text variant="body" color="inkMuted" style={{ padding: spacing.md }}>
              {t('scan.noScans')}
            </Text>
          ) : (
            data!.scans.map((s, i) => {
              const st = data!.states.find((x) => x.scan_id === s.id)?.check_state;
              const status = s.final_status ? t(`scan.status.${s.final_status}`) : st ? t(`scan.state.${st}`) : '';
              return (
                <View key={s.id}>
                  {i > 0 ? <Divider inset={52} /> : null}
                  <ListRow
                    icon={CROP_CALENDARS[s.crop_key].icon as IconName}
                    iconTone="accentSoft"
                    title={l(CROP_CALENDARS[s.crop_key].name)}
                    subtitle={`${formatDate(localDay(s.created_at), language)} · ${status}`}
                    onPress={() => router.push({ pathname: '/scan/[id]', params: { id: s.id } })}
                  />
                </View>
              );
            })
          )}
        </Card>
      </View>
    </Screen>
  );
}
