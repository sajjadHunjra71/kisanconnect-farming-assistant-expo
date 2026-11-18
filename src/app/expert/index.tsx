import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, Card, Icon, SampleDataNotice, Screen, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS } from '@/mocks/crops';
import { sampleQuestions } from '@/mocks/sample-data';
import { useTheme } from '@/theme';

export default function ExpertScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();

  return (
    <Screen header={<ScreenHeader back title="" large={false} />} footer={<Button label={t('expert.newQuestion')} icon="plus" onPress={() => router.push('/expert/ask')} />}>
      <View style={{ gap: spacing.sm }}>
        <Text variant="h1">{t('expert.title')}</Text>
        <Text variant="body" color="inkMuted">
          {t('expert.subtitle')}
        </Text>
      </View>

      <View style={{ flexDirection: row, gap: spacing.sm }}>
        <Button label={t('expert.helpline')} icon="phone-outline" variant="secondary" size="md" style={{ flex: 1 }} />
        <Button label={t('expert.whatsapp')} icon="whatsapp" variant="secondary" size="md" style={{ flex: 1 }} />
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('expert.myQuestions')} />
        <SampleDataNotice />
        {sampleQuestions.map((q) => {
          const crop = CROPS[q.cropId];
          const answered = q.status === 'answered';
          return (
            <Card key={q.id} onPress={() => undefined} style={{ flexDirection: row, gap: spacing.md }}>
              <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={crop.icon} size={24} color="warning" />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text variant="title">{l(q.title)}</Text>
                <Badge
                  label={answered ? t('expert.statusAnswered', { name: q.expertName ?? '' }) : t('expert.statusOpen')}
                  tone={answered ? 'success' : 'warning'}
                  icon={answered ? 'check-decagram' : 'clock-outline'}
                />
                <Text variant="caption" color="inkSubtle">
                  {l(crop.name)} · {l(q.askedAt)}
                  {q.photoCount ? ` · ${t('expert.photos', { count: q.photoCount })}` : ''}
                </Text>
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
