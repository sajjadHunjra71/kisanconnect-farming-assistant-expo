import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshControl, View } from 'react-native';

import { Button, Card, Divider, EmptyState, IconButton, ListRow, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text, type IconName } from '@/components/ui';
import { CROP_CALENDARS } from '@/engine';
import { formatDate } from '@/features/farm/format';
import { useLocalized } from '@/hooks/use-localized';
import { FarmCard, FarmSwitcher } from '@/features/farm/components';
import { useRepoQuery } from '@/features/farm/hooks';
import { CropProgressCard } from '@/features/home/components';
import { SyncStatus } from '@/features/sync/components';
import { useDirection } from '@/hooks/use-direction';
import { useSettingsStore } from '@/store/settings-store';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

export default function FarmScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { row } = useDirection();
  const selectedFarmId = useSettingsStore((s) => s.selectedFarmId);
  const setSelectedFarmId = useSettingsStore((s) => s.setSelectedFarmId);
  const [refreshing, setRefreshing] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const language = useSettingsStore((s) => s.language);
  const l = useLocalized();

  const { data, isSample, loading } = useRepoQuery(
    async (repos) => {
      const farms = await repos.farmsRepo.list();
      farms.sort((a, b) => a.created_at.localeCompare(b.created_at));
      const farm = farms.find((f) => f.id === selectedFarmId) ?? farms[0] ?? null;
      const crops = farm ? await repos.cropsRepo.list({ farmId: farm.id }) : [];
      return { farms, farm, crops };
    },
    [selectedFarmId],
  );
  const farm = data?.farm ?? null;
  const activeCrops = (data?.crops ?? []).filter((c) => c.status === 'active').sort((a, b) => a.sowing_date.localeCompare(b.sowing_date));
  const pastCrops = (data?.crops ?? [])
    .filter((c) => c.status !== 'active')
    .sort((a, b) => (b.harvested_on ?? b.sowing_date).localeCompare(a.harvested_on ?? a.sowing_date));

  const onRefresh = async () => {
    setRefreshing(true);
    await requestSync('full');
    setRefreshing(false);
  };

  return (
    <Screen
      withTabBar
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
      header={
        <ScreenHeader
          title={t('farm.title')}
          right={
            <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
              <SyncStatus />
              <IconButton icon="cog-outline" accessibilityLabel={t('farm.settings')} onPress={() => router.push('/settings')} />
            </View>
          }
          large
        />
      }>
      {isSample ? <SampleDataNotice /> : null}

      {!loading && !farm ? (
        <EmptyState icon="barn" title={t('farm.emptyTitle')} body={t('farm.emptyBody')} actionLabel={t('farm.addFarm')} onAction={() => router.push('/farm/edit')} />
      ) : null}

      {farm && data ? (
        <>
          {data.farms.length > 1 ? <FarmSwitcher farms={data.farms} selectedId={farm.id} onSelect={setSelectedFarmId} /> : null}
          <FarmCard farm={farm} onEdit={() => router.push({ pathname: '/farm/edit', params: { id: farm.id } })} />

          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t('farm.crops')} />
            {activeCrops.length === 0 ? (
              <Text variant="body" color="inkMuted">
                {t('crop.noCrops')}
              </Text>
            ) : null}
            {activeCrops.map((c) => (
              <CropProgressCard key={c.id} crop={c} onPress={() => router.push({ pathname: '/crop/[id]', params: { id: c.id } })} />
            ))}
            <Button label={t('farm.addCrop')} icon="plus" variant="secondary" onPress={() => router.push({ pathname: '/crop/edit', params: { farmId: farm.id } })} />
          </View>

          {pastCrops.length > 0 ? (
            <View style={{ gap: spacing.md }}>
              <SectionHeader title={t('crop.pastCrops')} actionLabel={showPast ? t('crop.hide') : `${t('crop.show')} (${pastCrops.length})`} onAction={() => setShowPast((v) => !v)} />
              {showPast ? (
                <Card style={{ paddingVertical: spacing.xs }}>
                  {pastCrops.map((c, i) => (
                    <View key={c.id}>
                      {i > 0 ? <Divider inset={52} /> : null}
                      <ListRow
                        icon={CROP_CALENDARS[c.crop_key].icon as IconName}
                        iconTone="surfaceAlt"
                        title={[l(CROP_CALENDARS[c.crop_key].name), c.variety].filter(Boolean).join(' · ')}
                        subtitle={[t(`crop.status.${c.status}`), c.harvested_on ? formatDate(c.harvested_on, language) : formatDate(c.sowing_date, language)].join(' · ')}
                        onPress={() => router.push({ pathname: '/crop/[id]', params: { id: c.id } })}
                      />
                    </View>
                  ))}
                </Card>
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}

      <Card tone="infoSoft" onPress={() => router.push('/expert')} style={{ gap: spacing.xs }}>
        <ListRow icon="account-tie-outline" iconTone="surfaceAlt" title={t('farm.expert')} subtitle={t('farm.expertBody')} chevron />
      </Card>

      <Card style={{ paddingVertical: spacing.xs }}>
        {farm ? (
          <>
            <ListRow icon="plus-circle-outline" iconTone="primarySoft" title={t('farm.addFarm')} onPress={() => router.push('/farm/edit')} />
            <Divider inset={52} />
          </>
        ) : null}
        <ListRow icon="chart-line-variant" iconTone="accentSoft" title={t('mandi.title')} onPress={() => router.push('/mandi')} />
        <Divider inset={52} />
        <ListRow icon="clipboard-text-clock-outline" iconTone="primarySoft" title={t('farm.activity')} onPress={() => undefined} />
        <Divider inset={52} />
        <ListRow icon="cog-outline" iconTone="surfaceAlt" title={t('farm.settings')} onPress={() => router.push('/settings')} />
      </Card>
    </Screen>
  );
}
