import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Divider, Text } from '@/components/ui';
import type { ActivityRecord, CropRecord } from '@/db';
import { CROP_CALENDARS, todayLocal } from '@/engine';
import { formatDate } from '@/features/farm/format';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

import { formatPkr } from './ActivityRow';
import { summarizeFarm } from './summary';

/** Last irrigation and sprays per active crop, plus total cost this season. */
export function FarmSummaryCard({ crops, activities }: { crops: CropRecord[]; activities: ActivityRecord[] }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const language = useSettingsStore((s) => s.language);
  const summary = summarizeFarm(crops, activities, todayLocal());
  if (summary.perCrop.length === 0) return null;

  const ago = (days: number | null) => (days === null ? t('summary.never') : days === 0 ? t('summary.today') : t('summary.daysAgo', { count: days }));

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="title">{t('summary.title')}</Text>
      {summary.perCrop.map((s, i) => {
        const crop = crops.find((c) => c.id === s.cropId)!;
        return (
          <View key={s.cropId} style={{ gap: spacing.xs }}>
            {i > 0 ? <Divider /> : null}
            <Text variant="label">{[l(CROP_CALENDARS[crop.crop_key].name), crop.variety].filter(Boolean).join(' · ')}</Text>
            <View style={{ flexDirection: row, justifyContent: 'space-between', gap: spacing.md }}>
              <Text variant="caption" color="inkMuted">
                {t('summary.lastIrrigation')}: {ago(s.daysSinceIrrigation)}
              </Text>
              <Text variant="caption" color="inkMuted">
                {t('summary.sprays')}: {s.spraysThisSeason}
              </Text>
            </View>
          </View>
        );
      })}
      {summary.seasonStart ? (
        <>
          <Divider />
          <View style={{ flexDirection: row, justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
            <Text variant="caption" color="inkMuted" style={{ flex: 1 }}>
              {t('summary.totalCost', { date: formatDate(summary.seasonStart, language) })}
            </Text>
            <Text variant="title">{t('activity.cost', { amount: formatPkr(summary.seasonCost, language) })}</Text>
          </View>
        </>
      ) : null}
    </Card>
  );
}
