import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, RefreshControl, View } from 'react-native';

import { Badge, Card, EmptyState, Icon, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { districtLabel } from '@/features/farm/format';
import { AdvisoryCard, DailyRow, DaySkyCard, HourlyStrip, SprayWindow } from '@/features/weather/components';
import { useFarmWeather } from '@/features/weather/use-farm-weather';
import { useDirection } from '@/hooks/use-direction';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function WeatherScreen() {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { row } = useDirection();
  const language = useSettingsStore((s) => s.language);
  const w = useFarmWeather();
  const [refreshing, setRefreshing] = useState(false);
  const v = w.view;

  const onRefresh = async () => {
    setRefreshing(true);
    await w.refresh();
    setRefreshing(false);
  };

  const place = w.farm ? districtLabel(w.farm.district, language, w.farm.name) : '';
  const all = v ? [...v.days, ...v.outlook] : [];
  const weekMin = all.length ? Math.min(...all.map((d) => d.minC)) : 0;
  const weekMax = all.length ? Math.max(...all.map((d) => d.maxC)) : 0;
  const [showHow, setShowHow] = useState(false);

  return (
    <Screen
      withTabBar
      padded={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={colors.primary} />}
      header={<ScreenHeader title={t('weather.title')} subtitle={place ? t('weather.subtitle', { district: place }) : undefined} />}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        {w.isSample ? <SampleDataNotice /> : null}
        {w.result?.offline ? <Badge label={t('weather.offline')} tone="warning" icon="cloud-off-outline" /> : null}
        {w.noFarm ? <EmptyState icon="barn" title={t('weather.noFarm')} actionLabel={t('farm.addFarm')} onAction={() => router.push('/farm/edit')} /> : null}
        {w.noLocation && w.farm ? (
          <EmptyState
            icon="map-marker-question-outline"
            title={t('weather.noLocation')}
            actionLabel={t('weather.setLocation')}
            onAction={() => router.push({ pathname: '/farm/edit', params: { id: w.farm!.id } })}
          />
        ) : null}
        {w.error ? (
          <Text variant="body" color="danger">
            {t('weather.loadFailed')}
          </Text>
        ) : null}
        {!v && w.loading ? <ActivityIndicator color={colors.primary} /> : null}
        {v && v.hours.length > 0 ? <DaySkyCard hours={v.hours} startIndex={v.nowIndex} /> : null}
      </View>

      {v ? (
        <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
          {v.old ? <Badge label={t('weather.oldForecast')} tone="warning" icon="clock-alert-outline" /> : null}
          {v.limited && !v.old ? (
            <Text variant="caption" color="warning">
              {t('weather.limitedData')}
            </Text>
          ) : null}
          {v.next24.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('weather.next24')} />
              <HourlyStrip hours={v.next24} />
            </View>
          ) : null}
          {v.spray.length > 0 ? <SprayWindow slots={v.spray.map((s) => ({ label: s.time.slice(11, 13), status: s.status }))} /> : null}

          <Card style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="water-outline" size={22} color="info" />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="caption" color="inkMuted">
                {t('weather.evapotranspiration')}
              </Text>
              <Text variant="title" latin>
                {t('weather.perDay', { value: v.now.et0Mm })}
              </Text>
            </View>
          </Card>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={t('weather.daily')} />
            <Card style={{ paddingVertical: spacing.sm }}>
              {v.days.map((d, i) => (
                <DailyRow key={`${d.day.en}-${i}`} day={d} weekMin={weekMin} weekMax={weekMax} />
              ))}
            </Card>
          </View>

          {v.outlook.length > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title={t('weather.outlook')} />
              <Card style={{ paddingVertical: spacing.sm, opacity: 0.85 }}>
                {v.outlook.map((d, i) => (
                  <DailyRow key={`o-${d.day.en}-${i}`} day={d} weekMin={weekMin} weekMax={weekMax} />
                ))}
              </Card>
            </View>
          ) : null}

          <View style={{ gap: spacing.md }}>
            <SectionHeader title={t('weather.advisories')} />
            {v.advisories.map((a) => (
              <AdvisoryCard key={a.id} advisory={a} />
            ))}
            <Text variant="caption" color="inkSubtle">
              {t('weather.indicative')}
            </Text>
            <Card tone="surfaceAlt" onPress={() => setShowHow((x) => !x)} accessibilityLabel={t('weather.howTitle')} style={{ gap: spacing.xs }}>
              <Text variant="label" color="primary">
                {t('weather.howTitle')}
              </Text>
              {showHow ? (
                <Text variant="caption" color="inkMuted">
                  {t('weather.howBody')}
                </Text>
              ) : null}
            </Card>
          </View>

          <Text variant="caption" color="inkSubtle" align="center" latin>
            {v.attribution}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}
