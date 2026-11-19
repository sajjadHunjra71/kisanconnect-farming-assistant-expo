import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Divider, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { ACTIVITY_TYPES, type ActivityType } from '@/db';
import { CROP_CALENDARS } from '@/engine';
import { ActivityRow } from '@/features/activity/ActivityRow';
import { ACTIVITY_META } from '@/features/activity/meta';
import { useRepoQuery } from '@/features/farm/hooks';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';

type CropFilter = 'all' | 'farm' | string;

/** Activity timeline for one farm, filterable by crop and type. Tap to edit. */
export default function ActivityLogScreen() {
  const { farmId } = useLocalSearchParams<{ farmId: string }>();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const [cropFilter, setCropFilter] = useState<CropFilter>('all');
  const [typeFilter, setTypeFilter] = useState<ActivityType | 'all'>('all');

  const { data } = useRepoQuery(
    async (r) => {
      const [farm, crops, activities] = await Promise.all([r.farmsRepo.get(farmId), r.cropsRepo.list({ farmId }), r.activitiesRepo.list({ farmId })]);
      activities.sort((a, b) => b.done_on.localeCompare(a.done_on) || b.created_at.localeCompare(a.created_at));
      return { farm, crops, activities };
    },
    [farmId],
  );

  const cropName = (id: string | null) => {
    const c = data?.crops.find((x) => x.id === id);
    return c ? [l(CROP_CALENDARS[c.crop_key].name), c.variety].filter(Boolean).join(' · ') : undefined;
  };
  const shown = (data?.activities ?? []).filter(
    (a) => (cropFilter === 'all' || (cropFilter === 'farm' ? a.crop_id === null : a.crop_id === cropFilter)) && (typeFilter === 'all' || a.type === typeFilter),
  );
  const chips = { flexDirection: row, gap: spacing.sm };

  return (
    <Screen
      header={<ScreenHeader back title={t('activity.title')} subtitle={data?.farm?.name} large={false} />}
      footer={<Button label={t('activity.log')} icon="plus" onPress={() => router.push({ pathname: '/activity/edit', params: { farmId } })} />}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chips}>
        <Chip label={t('activity.all')} selected={cropFilter === 'all'} onPress={() => setCropFilter('all')} />
        <Chip label={t('activity.wholeFarm')} icon="barn" selected={cropFilter === 'farm'} onPress={() => setCropFilter('farm')} />
        {(data?.crops ?? []).map((c) => (
          <Chip key={c.id} label={cropName(c.id) ?? ''} selected={cropFilter === c.id} onPress={() => setCropFilter(c.id)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={chips}>
        <Chip label={t('activity.all')} selected={typeFilter === 'all'} onPress={() => setTypeFilter('all')} />
        {ACTIVITY_TYPES.map((k) => (
          <Chip key={k} label={t(`activity.types.${k}`)} icon={ACTIVITY_META[k].icon} selected={typeFilter === k} onPress={() => setTypeFilter(k)} />
        ))}
      </ScrollView>

      {data && shown.length === 0 ? (
        data.activities.length === 0 ? (
          <EmptyState icon="clipboard-text-clock-outline" title={t('activity.empty')} />
        ) : (
          <Text variant="body" color="inkMuted" align="center">
            {t('activity.emptyFiltered')}
          </Text>
        )
      ) : null}

      {shown.length > 0 ? (
        <Card style={{ paddingVertical: spacing.xs }}>
          {shown.map((a, i) => (
            <View key={a.id}>
              {i > 0 ? <Divider inset={52} /> : null}
              <ActivityRow
                activity={a}
                cropLabel={cropFilter === 'all' ? cropName(a.crop_id) : undefined}
                onPress={() => router.push({ pathname: '/activity/edit', params: { id: a.id } })}
              />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}
