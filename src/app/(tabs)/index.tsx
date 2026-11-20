import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Divider, EmptyState, SampleDataNotice, Screen, SectionHeader } from '@/components/ui';
import { useRepoQuery } from '@/features/farm/hooks';
import { districtLabel } from '@/features/farm/format';
import { CropProgressCard, GreetingHeader, QuickActions, TaskItem, WeatherHero } from '@/features/home/components';
import { PriceCard } from '@/features/mandi/components';
import { AdvisoryCard } from '@/features/weather/components';
import { useLocalized } from '@/hooks/use-localized';
import { sampleFarm, sampleMandi, sampleTasks, sampleUser } from '@/mocks/sample-data';
import { useFarmWeather } from '@/features/weather/use-farm-weather';
import { selectDisplayName, useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const displayName = useAuthStore(selectDisplayName);
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLocalized();
  const selectedFarmId = useSettingsStore((s) => s.selectedFarmId);
  const weather = useFarmWeather();
  const language = useSettingsStore((s) => s.language);
  const { data } = useRepoQuery(
    async (repos) => {
      const farms = (await repos.farmsRepo.list()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const farm = farms.find((f) => f.id === selectedFarmId) ?? farms[0] ?? null;
      const crops = farm ? (await repos.cropsRepo.list({ farmId: farm.id })).filter((c) => c.status === 'active') : [];
      crops.sort((a, b) => a.sowing_date.localeCompare(b.sowing_date));
      return { farm, crops, unread: await repos.alertsLocal.unreadCount() };
    },
    [selectedFarmId],
  );
  const location = data?.farm ? districtLabel(data.farm.district, language, data.farm.name) : l(sampleFarm.district);

  return (
    <Screen withTabBar>
      <GreetingHeader name={displayName ?? sampleUser.name} location={location} unread={data?.unread ?? 0} />
      <SampleDataNotice />
      {weather.view ? <WeatherHero weather={weather.view.now} offline={weather.result?.offline} onPress={() => router.push('/(tabs)/weather')} /> : null}
      <QuickActions />
      {data && data.crops.length === 0 ? (
        <Card>
          <EmptyState icon="sprout-outline" title={t('home.noCropsTitle')} body={t('home.noCropsBody')} actionLabel={t('farm.title')} onAction={() => router.push('/(tabs)/farm')} />
        </Card>
      ) : null}
      {(data?.crops ?? []).slice(0, 3).map((c) => (
        <CropProgressCard key={c.id} crop={c} onPress={() => router.push({ pathname: '/crop/[id]', params: { id: c.id } })} />
      ))}

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('home.advisories')} actionLabel={t('common.seeAll')} onAction={() => router.push('/(tabs)/weather')} />
        {(weather.view?.advisories ?? []).slice(0, 2).map((a) => (
          <AdvisoryCard key={a.id} advisory={a} />
        ))}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('home.tasks')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {sampleTasks.map((task, i) => (
            <View key={task.id}>
              {i > 0 ? <Divider inset={40} /> : null}
              <TaskItem task={task} />
            </View>
          ))}
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('home.mandiTitle')} actionLabel={t('common.seeAll')} onAction={() => router.push('/mandi')} />
        <PriceCard price={sampleMandi[0]} compact />
      </View>
    </Screen>
  );
}
