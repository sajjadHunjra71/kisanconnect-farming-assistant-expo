import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Button, Card, Icon, ListRow, Screen, ScreenHeader, SectionHeader, Text, type IconName } from '@/components/ui';
import { CropPicker } from '@/features/farm/components';
import { Viewfinder } from '@/features/scan/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { sampleScan } from '@/mocks/sample-data';
import { useTheme } from '@/theme';
import type { CropId } from '@/types/domain';

export default function ScanScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const [crop, setCrop] = useState<CropId>('wheat');

  const tips: { icon: IconName; text: string }[] = [
    { icon: 'white-balance-sunny', text: t('scan.tipLight') },
    { icon: 'leaf', text: t('scan.tipClose') },
    { icon: 'hand-back-right-outline', text: t('scan.tipFocus') },
  ];

  const openResult = () => router.push('/scan/result');

  return (
    <Screen withTabBar header={<ScreenHeader title={t('scan.title')} subtitle={t('scan.subtitle')} />}>
      <View style={{ gap: spacing.md }}>
        <Text variant="title">{t('scan.selectCrop')}</Text>
        <CropPicker crops={['wheat', 'rice', 'cotton']} value={crop} onChange={setCrop} />
      </View>

      <Viewfinder hint={t('scan.tipClose')} />

      <View style={{ gap: spacing.sm }}>
        <Button label={t('scan.takePhoto')} icon="camera" variant="accent" onPress={openResult} />
        <Button label={t('scan.gallery')} icon="image-outline" variant="secondary" onPress={openResult} />
      </View>

      <Card tone="surfaceAlt" style={{ gap: spacing.md }}>
        <Text variant="overline" color="inkMuted">
          {t('scan.tipsTitle')}
        </Text>
        {tips.map((tip) => (
          <View key={tip.icon} style={{ flexDirection: row, alignItems: 'center', gap: spacing.md }}>
            <Icon name={tip.icon} size={20} color="primary" />
            <Text variant="body" style={{ flex: 1 }}>
              {tip.text}
            </Text>
          </View>
        ))}
      </Card>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title={t('scan.recent')} />
        <Card style={{ paddingVertical: spacing.xs }}>
          <ListRow
            icon={CROPS[sampleScan.cropId].icon}
            iconTone="accentSoft"
            title={l(sampleScan.causes[0].name)}
            subtitle={`${l(CROPS[sampleScan.cropId].name)} · ${t('scan.statusLikely')}`}
            onPress={openResult}
          />
        </Card>
      </View>
    </Screen>
  );
}
