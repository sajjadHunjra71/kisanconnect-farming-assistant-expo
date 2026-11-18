import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, PressableScale, StatTile, Text } from '@/components/ui';
import { conditionIcon } from '@/features/weather/weather-icons';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { WeatherNow } from '@/types/domain';

type Props = { weather: WeatherNow; onPress?: () => void };

export function WeatherHero({ weather, onPress }: Props) {
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const { t } = useTranslation();
  const minutes = Math.round((Date.now() - new Date(weather.updatedAt).getTime()) / 60_000);

  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${weather.tempC}°, ${t(`weather.conditions.${weather.condition}`)}`}>
      <LinearGradient colors={[colors.heroFrom, colors.heroTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.lg, overflow: 'hidden' }}>
        <Icon name={conditionIcon[weather.condition]} size={160} tint="rgba(255,255,255,0.08)" style={{ position: 'absolute', top: -20, ...(isRTL ? { left: 40 } : { right: -24 }) }} />
        <View style={{ flexDirection: row, alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text variant="display" latin style={{ color: colors.onHero }}>
              {weather.tempC}°
            </Text>
            <Text variant="title" style={{ color: colors.onHero }}>
              {t(`weather.conditions.${weather.condition}`)}
            </Text>
            <Text variant="caption" style={{ color: colors.onHeroMuted }}>
              {t('home.feelsLike', { temp: weather.feelsLikeC })}
            </Text>
          </View>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Icon name={conditionIcon[weather.condition]} size={54} tint={colors.accent} />
          </View>
        </View>
        <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.14)' }} />
        <View style={{ flexDirection: row, gap: spacing.md }}>
          <StatTile onHero icon="water-percent" label={t('home.humidity')} value={`${weather.humidity}%`} />
          <StatTile onHero icon="weather-windy" label={t('home.wind')} value={`${weather.windKmh} km/h`} />
          <StatTile onHero icon="umbrella-outline" label={t('home.rain')} value={`${weather.rainChance}%`} />
        </View>
        <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="caption" style={{ color: colors.onHeroMuted }}>
            {t('common.updatedMinutes', { count: minutes })} · {weather.source}
          </Text>
          {onPress ? (
            <View style={{ flexDirection: row, alignItems: 'center', gap: 4 }}>
              <Text variant="label" style={{ color: colors.onHero }}>
                {t('home.seeWeather')}
              </Text>
              <Icon name="chevron-right" size={18} tint={colors.onHero} directional />
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </PressableScale>
  );
}
