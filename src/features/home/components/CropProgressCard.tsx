import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, ProgressBar, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS, currentStage } from '@/mocks/crops';
import { useTheme } from '@/theme';
import type { FarmCrop } from '@/types/domain';

export function CropProgressCard({ crop, onPress }: { crop: FarmCrop; onPress?: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const def = CROPS[crop.cropId];
  const { day, stage, progress } = currentStage(crop.cropId, crop.sowingDate);

  return (
    <Card onPress={onPress} accessibilityLabel={l(def.name)} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={def.icon} size={26} color="warning" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{t('home.cropProgress', { crop: l(def.name), stage: l(stage.name) })}</Text>
          <Text variant="caption" color="inkMuted">
            {t('common.day', { count: day })} · {crop.variety} · {t('common.acres', { count: crop.areaAcres })}
          </Text>
        </View>
      </View>
      <ProgressBar value={progress} color={colors.accent} />
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        {def.stages.map((s) => (
          <View
            key={s.key}
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: day >= s.startDay ? colors.primary : colors.border }}
          />
        ))}
      </View>
      <Text variant="caption" color="inkSubtle">
        {t('home.daysToHarvest', { count: Math.max(0, def.seasonDays - day) })}
      </Text>
    </Card>
  );
}
