import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';
import type { Advisory, AdvisoryKind } from '@/types/domain';
import { severityTone } from '../weather-icons';
import type { IconName } from '@/components/ui/Icon';

const kindIcon: Record<AdvisoryKind, IconName> = {
  spray: 'spray',
  irrigation: 'water-outline',
  'disease-risk': 'virus-outline',
  heat: 'thermometer-high',
  frost: 'snowflake',
  rain: 'weather-pouring',
  wind: 'weather-windy',
  fog: 'weather-fog',
};

export function AdvisoryCard({ advisory }: { advisory: Advisory }) {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const tone = severityTone[advisory.severity];
  const { t } = useTranslation();
  const action = advisory.action;
  const runAction = () => {
    if (!action) return;
    if (action.kind === 'scan') router.push('/(tabs)/scan');
    else router.push({ pathname: '/activity/edit', params: { farmId: action.farmId, cropId: action.cropId, type: 'irrigation' } });
  };

  return (
    <View
      accessible={!action}
      accessibilityLabel={`${l(advisory.title)}. ${l(advisory.body)}`}
      style={{ flexDirection: row, gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors[tone.bg], alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={kindIcon[advisory.kind]} size={22} color={tone.fg} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="title">{l(advisory.title)}</Text>
        <Text variant="body" color="inkMuted">
          {l(advisory.body)}
        </Text>
        <Text variant="caption" color="inkSubtle" latin>
          {advisory.source}
        </Text>
        {action ? (
          <Button
            label={action.kind === 'scan' ? t('advice.openScan') : t('advice.logIrrigation')}
            icon={action.kind === 'scan' ? 'line-scan' : 'water-plus-outline'}
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={runAction}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          />
        ) : null}
      </View>
    </View>
  );
}
