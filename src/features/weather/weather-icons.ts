import type { IconName } from '@/components/ui/Icon';
import type { Palette } from '@/theme/colors';
import type { Severity, WeatherCondition } from '@/types/domain';

export const conditionIcon: Record<WeatherCondition, IconName> = {
  clear: 'weather-sunny',
  'partly-cloudy': 'weather-partly-cloudy',
  cloudy: 'weather-cloudy',
  rain: 'weather-pouring',
  storm: 'weather-lightning-rainy',
  fog: 'weather-fog',
  hot: 'white-balance-sunny',
};

export const severityTone: Record<Severity, { bg: keyof Palette; fg: keyof Palette; icon: IconName }> = {
  good: { bg: 'successSoft', fg: 'success', icon: 'check-circle-outline' },
  info: { bg: 'infoSoft', fg: 'info', icon: 'information-outline' },
  warning: { bg: 'warningSoft', fg: 'warning', icon: 'alert-outline' },
  danger: { bg: 'dangerSoft', fg: 'danger', icon: 'alert-octagon-outline' },
};
