import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Icon, ProgressBar, Text, type IconName } from '@/components/ui';
import type { CropRecord } from '@/db';
import { CROP_CALENDARS, cropProgress } from '@/engine';
import { formatArea } from '@/features/farm/format';
import { UpdatedElsewhereNote } from '@/features/sync/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';

type CardCrop = Pick<CropRecord, 'id' | 'crop_key' | 'variety' | 'sowing_date' | 'area_value' | 'area_unit'>;

export function CropProgressCard({ crop, onPress }: { crop: CardCrop; onPress?: () => void }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const def = CROP_CALENDARS[crop.crop_key];
  const p = cropProgress(crop.crop_key, crop.sowing_date);

  const meta = [
    p.status === 'planned' ? null : t('common.day', { count: p.day }),
    crop.variety,
    crop.area_value != null && crop.area_unit ? formatArea(t, crop.area_value, crop.area_unit) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const footer =
    p.status === 'planned'
      ? t('crop.planned', { count: p.daysUntil })
      : p.status === 'completed'
        ? t('crop.seasonDone')
        : t('home.daysToHarvest', { count: Math.max(0, def.seasonDays - p.day) });

  return (
    <Card onPress={onPress} accessibilityLabel={`${l(def.name)}, ${l(p.stage.name)}`} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
        <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={def.icon as IconName} size={26} color="warning" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title">{t('home.cropProgress', { crop: l(def.name), stage: l(p.stage.name) })}</Text>
          {meta ? (
            <Text variant="caption" color="inkMuted">
              {meta}
            </Text>
          ) : null}
        </View>
      </View>
      <UpdatedElsewhereNote table="crops" id={crop.id} />
      <ProgressBar value={p.progress} color={colors.accent} />
      <View style={{ flexDirection: row, justifyContent: 'space-between' }}>
        {def.stages.map((s) => (
          <View
            key={s.key}
            style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.status !== 'planned' && p.day >= s.startDay ? colors.primary : colors.border }}
          />
        ))}
      </View>
      <Text variant="caption" color="inkSubtle">
        {footer}
      </Text>
    </Card>
  );
}
