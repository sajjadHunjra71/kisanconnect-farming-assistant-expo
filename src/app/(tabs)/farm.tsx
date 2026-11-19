import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';

import { Button, Card, Divider, IconButton, ListRow, SampleDataNotice, Screen, ScreenHeader, SectionHeader, StatTile, Text } from '@/components/ui';
import { CropProgressCard } from '@/features/home/components';
import { SyncStatus } from '@/features/sync/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { sampleFarm } from '@/mocks/sample-data';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

export default function FarmScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const [refreshing, setRefreshing] = useState(false);
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
      <SampleDataNotice />
      <Card elevated style={{ gap: spacing.lg }}>
        <Text variant="h2">{l(sampleFarm.name)}</Text>
        <View style={{ flexDirection: row, gap: spacing.md }}>
          <StatTile icon="map-marker-outline" label={t('farm.district')} value={l(sampleFarm.district)} />
          <StatTile icon="ruler-square" label={t('farm.area')} value={t('common.acres', { count: sampleFarm.areaAcres })} />
          <StatTile icon="terrain" label={t('farm.soil')} value={l(sampleFarm.soil)} />
        </View>
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('farm.crops')} />
        {sampleFarm.crops.map((c) => (
          <CropProgressCard key={c.id} crop={c} />
        ))}
        <Button label={t('farm.addCrop')} icon="plus" variant="secondary" />
      </View>

      <Card tone="infoSoft" onPress={() => router.push('/expert')} style={{ gap: spacing.xs }}>
        <ListRow icon="account-tie-outline" iconTone="surfaceAlt" title={t('farm.expert')} subtitle={t('farm.expertBody')} chevron />
      </Card>

      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="chart-line-variant" iconTone="accentSoft" title={t('mandi.title')} onPress={() => router.push('/mandi')} />
        <Divider inset={52} />
        <ListRow icon="clipboard-text-clock-outline" iconTone="primarySoft" title={t('farm.activity')} onPress={() => undefined} />
        <Divider inset={52} />
        <ListRow icon="cog-outline" iconTone="surfaceAlt" title={t('farm.settings')} onPress={() => router.push('/settings')} />
      </Card>
    </Screen>
  );
}
