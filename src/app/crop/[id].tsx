import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, View } from 'react-native';

import { Badge, Button, Card, Divider, Icon, IconButton, Screen, ScreenHeader, SectionHeader, Text, type IconName } from '@/components/ui';
import { ValidationError } from '@/db';
import { CROP_CALENDARS, cropProgress, todayLocal } from '@/engine';
import { ActivityRow } from '@/features/activity/ActivityRow';
import { formatArea, formatDate } from '@/features/farm/format';
import { useRepoQuery } from '@/features/farm/hooks';
import { UpdatedElsewhereNote } from '@/features/sync/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

export default function CropDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { spacing, colors, radius } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const language = useSettingsStore((s) => s.language);

  const { data, repos } = useRepoQuery(
    async (r) => {
      const crop = await r.cropsRepo.get(id);
      const activities = crop ? await r.activitiesRepo.list({ cropId: id }) : [];
      activities.sort((a, b) => b.done_on.localeCompare(a.done_on) || b.created_at.localeCompare(a.created_at));
      return { crop, activities };
    },
    [id],
  );
  const crop = data?.crop;
  if (!crop) return <Screen header={<ScreenHeader back title="" large={false} />}>{null}</Screen>;

  const def = CROP_CALENDARS[crop.crop_key];
  const active = crop.status === 'active';
  // A harvested/failed crop is shown as it was on its last day.
  const p = cropProgress(crop.crop_key, crop.sowing_date, active ? undefined : (crop.harvested_on ?? crop.updated_at.slice(0, 10)));
  const isLast = p.stageIndex === def.stages.length - 1;

  const markHarvested = () =>
    Alert.alert(t('crop.harvestTitle'), t('crop.harvestBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('crop.harvestConfirm'),
        onPress: async () => {
          try {
            await repos?.cropsRepo.update(crop.id, { status: 'harvested', harvested_on: todayLocal() });
          } catch (e) {
            if (e instanceof ValidationError) Alert.alert(t(`crop.errors.${e.field}`, { defaultValue: t('crop.errors.generic') }));
          }
        },
      },
    ]);

  const confirmDelete = () =>
    Alert.alert(t('crop.deleteTitle'), t('crop.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('crop.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          await repos?.cropsRepo.remove(crop.id);
          router.back();
        },
      },
    ]);

  const nextLine =
    p.status === 'planned'
      ? t('crop.planned', { count: p.daysUntil })
      : p.status === 'completed'
        ? t('crop.seasonDone')
        : isLast
          ? t('crop.lastStage')
          : t('crop.nextStage', { count: p.daysLeftInStage + 1 });

  return (
    <Screen
      header={
        <ScreenHeader
          back
          title={l(def.name)}
          subtitle={crop.variety ?? undefined}
          large={false}
          right={<IconButton icon="pencil-outline" accessibilityLabel={t('crop.editCrop')} onPress={() => router.push({ pathname: '/crop/edit', params: { id: crop.id } })} />}
        />
      }>
      <Card elevated style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={def.icon as IconName} size={26} color="warning" />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="title">{active ? l(p.stage.name) : t(`crop.status.${crop.status}`)}</Text>
            <Text variant="caption" color="inkMuted">
              {[
                crop.variety,
                t('crop.sown', { date: formatDate(crop.sowing_date, language) }),
                crop.harvested_on ? t('crop.harvestedOn', { date: formatDate(crop.harvested_on, language) }) : null,
                crop.area_value != null && crop.area_unit ? formatArea(t, crop.area_value, crop.area_unit) : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>
        <UpdatedElsewhereNote table="crops" id={crop.id} />
        {active ? (
          <Text variant="body" color="primary">
            {nextLine}
          </Text>
        ) : null}
      </Card>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('crop.timeline')} />
        <Card style={{ gap: spacing.md }}>
          {def.stages.map((s, i) => {
            const done = p.status === 'completed' || (p.status === 'growing' && (active ? i < p.stageIndex : i <= p.stageIndex));
            const current = active && p.status === 'growing' && i === p.stageIndex;
            return (
              <View key={s.key} style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }} accessibilityState={{ selected: current }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: current ? colors.primary : done ? colors.primarySoft : colors.surfaceAlt,
                  }}>
                  {done ? <Icon name="check" size={14} color="primary" /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant={current ? 'title' : 'body'} color={current ? 'primary' : done ? 'inkMuted' : 'ink'}>
                    {l(s.name)}
                  </Text>
                  <Text variant="caption" color="inkSubtle">
                    {t('common.day', { count: s.startDay })}–{s.endDay}
                  </Text>
                </View>
                {current ? <Badge label={t('common.day', { count: p.day })} tone="primary" /> : null}
              </View>
            );
          })}
          <Text variant="caption" color="inkSubtle">
            {t('crop.indicative')}
          </Text>
        </Card>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('crop.activity')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          {data.activities.length === 0 ? (
            <Text variant="body" color="inkMuted" style={{ padding: spacing.md }}>
              {t('crop.noActivity')}
            </Text>
          ) : (
            data.activities.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <Divider inset={52} /> : null}
                <ActivityRow activity={a} onPress={() => router.push({ pathname: '/activity/edit', params: { id: a.id } })} />
              </View>
            ))
          )}
        </Card>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Button label={t('activity.log')} icon="clipboard-edit-outline" onPress={() => router.push({ pathname: '/activity/edit', params: { farmId: crop.farm_id, cropId: crop.id } })} />
        {active ? <Button label={t('crop.markHarvested')} icon="basket-check-outline" variant="secondary" onPress={markHarvested} /> : null}
        <Button label={t('crop.delete')} icon="delete-outline" variant="danger" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}
