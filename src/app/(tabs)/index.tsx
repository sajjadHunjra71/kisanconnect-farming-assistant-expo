import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Divider, SampleDataNotice, Screen, SectionHeader } from '@/components/ui';
import { CropProgressCard, GreetingHeader, QuickActions, TaskItem, WeatherHero } from '@/features/home/components';
import { PriceCard } from '@/features/mandi/components';
import { AdvisoryCard } from '@/features/weather/components';
import { useLocalized } from '@/hooks/use-localized';
import { sampleAdvisories, sampleFarm, sampleMandi, sampleTasks, sampleUser, sampleWeatherNow } from '@/mocks/sample-data';
import { selectDisplayName, useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

export default function HomeScreen() {
  const displayName = useAuthStore(selectDisplayName);
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLocalized();
  const mainCrop = sampleFarm.crops[0];

  return (
    <Screen withTabBar>
      <GreetingHeader name={displayName ?? sampleUser.name} location={l(sampleFarm.district)} />
      <SampleDataNotice />
      <WeatherHero weather={sampleWeatherNow} onPress={() => router.push('/(tabs)/weather')} />
      <QuickActions />
      <CropProgressCard crop={mainCrop} onPress={() => router.push('/(tabs)/farm')} />

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('home.advisories')} actionLabel={t('common.seeAll')} onAction={() => router.push('/(tabs)/weather')} />
        {sampleAdvisories.slice(0, 2).map((a) => (
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
