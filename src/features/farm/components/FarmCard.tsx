import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, IconButton, StatTile, Text } from '@/components/ui';
import type { FarmRecord } from '@/db';
import { UpdatedElsewhereNote } from '@/features/sync/components';
import { useDirection } from '@/hooks/use-direction';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

import { districtLabel, formatArea } from '../format';

export function FarmCard({ farm, onEdit }: { farm: FarmRecord; onEdit?: () => void }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const language = useSettingsStore((s) => s.language);

  return (
    <Card elevated style={{ gap: spacing.lg }}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text variant="h2" numberOfLines={2}>
            {farm.name}
          </Text>
          <UpdatedElsewhereNote table="farms" id={farm.id} />
        </View>
        {onEdit ? <IconButton icon="pencil-outline" accessibilityLabel={t('farm.editFarm')} onPress={onEdit} /> : null}
      </View>
      <View style={{ flexDirection: row, gap: spacing.md }}>
        <StatTile icon="map-marker-outline" label={t('farm.district')} value={districtLabel(farm.district, language, t('farm.noDistrict'))} />
        <StatTile icon="ruler-square" label={t('farm.area')} value={formatArea(t, farm.area_value, farm.area_unit)} />
        <StatTile icon="terrain" label={t('farm.soil')} value={farm.soil_type ? t(`farm.soilTypes.${farm.soil_type}`) : '—'} />
      </View>
    </Card>
  );
}
