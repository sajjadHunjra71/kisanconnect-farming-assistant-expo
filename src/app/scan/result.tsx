import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, Card, Icon, IconButton, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { BulletList, LikelihoodMeter, Reveal, RevealCard, ScanSweep } from '@/features/scan/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { sampleScan } from '@/mocks/sample-data';
import { useTheme } from '@/theme';

export default function ScanResultScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const scan = sampleScan;
  const [main, ...others] = scan.causes;
  const crop = CROPS[scan.cropId];
  const [revealed, setRevealed] = useState(false);
  const onScanned = useCallback(() => {
    setRevealed(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);
  const statusLabel = scan.status === 'likely' ? t('scan.statusLikely') : scan.status === 'possible' ? t('scan.statusPossible') : t('scan.statusUnclear');

  return (
    <Screen
      header={<ScreenHeader back title={t('scan.resultTitle')} large={false} />}
      footer={
        <View style={{ flexDirection: row, gap: spacing.sm }}>
          <Button label={t('scan.askExpert')} icon="account-tie-outline" onPress={() => router.push('/expert/ask')} style={{ flex: 1 }} />
          <IconButton icon="whatsapp" size={56} accessibilityLabel={t('scan.share')} iconColor="success" />
        </View>
      }>
      <SampleDataNotice />

      <RevealCard revealed={revealed}>
        <Card padded={false} elevated>
          <View
            style={{
              height: 150,
              backgroundColor: '#1D3A2A',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name="leaf" size={88} tint="#C9B04A" />
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                flexDirection: row,
                justifyContent: 'space-between',
              }}>
              <Badge label={l(crop.name)} tone="accent" icon={crop.icon} />
              <Badge label={t('scan.model', { version: scan.modelVersion })} tone="neutral" />
            </View>
            {revealed ? null : <ScanSweep height={150} onDone={onScanned} />}
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.sm }}>
            <Reveal revealed={revealed} index={0}>
              <Text variant="overline" color="danger">
                {statusLabel}
              </Text>
            </Reveal>
            <Reveal revealed={revealed} index={1}>
              <Text variant="h2">{l(main.name)}</Text>
            </Reveal>
            <Reveal revealed={revealed} index={2}>
              <LikelihoodMeter value={main.likelihood} />
            </Reveal>
            <Reveal revealed={revealed} index={3}>
              <Text variant="body" color="inkMuted">
                {l(main.signs)}
              </Text>
            </Reveal>
          </View>
        </Card>
      </RevealCard>

      <Reveal
        revealed={revealed}
        index={4}
        style={{
          flexDirection: row,
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.warningSoft,
        }}>
        <Icon name="shield-alert-outline" size={22} color="warning" />
        <Text variant="body" style={{ flex: 1 }}>
          {t('scan.disclaimer')}
        </Text>
      </Reveal>

      <Reveal revealed={revealed} index={5} style={{ gap: spacing.md }}>
        <SectionHeader title={t('scan.checks')} />
        <Card>
          <BulletList items={scan.checks.map(l)} />
        </Card>
      </Reveal>

      <Reveal revealed={revealed} index={6} style={{ gap: spacing.md }}>
        <SectionHeader title={t('scan.nextSteps')} />
        <Card>
          <BulletList numbered items={scan.nextSteps.map(l)} />
        </Card>
        <Text variant="caption" color="inkSubtle" latin>
          {t('common.source', { source: scan.source })}
        </Text>
      </Reveal>

      {others.length ? (
        <View style={{ gap: spacing.md }}>
          <SectionHeader title={t('scan.otherCauses')} />
          {others.map((c) => (
            <Card key={c.id} style={{ gap: spacing.xs }}>
              <Text variant="title">{l(c.name)}</Text>
              <LikelihoodMeter value={c.likelihood} />
              <Text variant="caption" color="inkMuted">
                {l(c.signs)}
              </Text>
            </Card>
          ))}
        </View>
      ) : null}

      <Button label={t('scan.scanAgain')} icon="camera-retake-outline" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
