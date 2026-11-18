import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Chip, Icon, SampleDataNotice, Screen, ScreenHeader, Text } from '@/components/ui';
import { PriceCard } from '@/features/mandi/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { sampleMandi } from '@/mocks/sample-data';
import { useTheme } from '@/theme';
import type { CropId } from '@/types/domain';

export default function MandiScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const [filter, setFilter] = useState<CropId | 'all'>('all');
  const list = filter === 'all' ? sampleMandi : sampleMandi.filter((p) => p.cropId === filter);

  return (
    <Screen padded={false} header={<ScreenHeader back title="" large={false} />}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        <Text variant="h1">{t('mandi.title')}</Text>
        <Text variant="body" color="inkMuted">
          {t('mandi.subtitle')}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl, flexDirection: row }}>
        <Chip label={t('mandi.allCrops')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {sampleMandi.map((p) => (
          <Chip key={p.cropId} label={l(CROPS[p.cropId].name)} icon={CROPS[p.cropId].icon} selected={filter === p.cropId} onPress={() => setFilter(p.cropId)} />
        ))}
      </ScrollView>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
        <SampleDataNotice />
        <View style={{ flexDirection: row, gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.infoSoft }}>
          <Icon name="calendar-clock" size={20} color="info" />
          <Text variant="body" style={{ flex: 1 }}>
            {t('mandi.notLive')}
          </Text>
        </View>
        {list.map((p) => (
          <PriceCard key={p.id} price={p} />
        ))}
      </View>
    </Screen>
  );
}
