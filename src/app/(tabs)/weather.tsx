import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { AdvisoryCard, DailyRow, DaySkyCard, SprayWindow } from '@/features/weather/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { sampleAdvisories, sampleDayHours, sampleDaily, sampleFarm, sampleWeatherNow } from '@/mocks/sample-data';
import { useTheme } from '@/theme';

const SPRAY_SLOTS = [
  { label: '8', ok: true },
  { label: '10', ok: true },
  { label: '12', ok: true },
  { label: '14', ok: true },
  { label: '16', ok: false },
  { label: '18', ok: false },
  { label: '20', ok: false },
  { label: '22', ok: false },
];

export default function WeatherScreen() {
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const weekMin = Math.min(...sampleDaily.map((d) => d.minC));
  const weekMax = Math.max(...sampleDaily.map((d) => d.maxC));
  const nowIndex = Math.min(sampleDayHours.length - 1, Math.max(0, new Date().getHours() - 6));

  return (
    <Screen withTabBar padded={false} header={<ScreenHeader title={t('weather.title')} subtitle={t('weather.subtitle', { district: l(sampleFarm.district) })} />}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.lg }}>
        <SampleDataNotice />
        <DaySkyCard hours={sampleDayHours} startIndex={nowIndex} />
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }}>
        <SprayWindow slots={SPRAY_SLOTS} />

        <Card style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: colors.infoSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="water-outline" size={22} color="info" />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color="inkMuted">
              {t('weather.evapotranspiration')}
            </Text>
            <Text variant="title" latin>
              {t('weather.perDay', { value: sampleWeatherNow.et0Mm })}
            </Text>
          </View>
        </Card>

        <View style={{ gap: spacing.sm }}>
          <SectionHeader title={t('weather.daily')} />
          <Card style={{ paddingVertical: spacing.sm }}>
            {sampleDaily.map((d) => (
              <DailyRow key={d.day.en} day={d} weekMin={weekMin} weekMax={weekMax} />
            ))}
          </Card>
        </View>

        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t('weather.advisories')} />
          {sampleAdvisories.map((a) => (
            <AdvisoryCard key={a.id} advisory={a} />
          ))}
        </View>
      </View>
    </Screen>
  );
}
