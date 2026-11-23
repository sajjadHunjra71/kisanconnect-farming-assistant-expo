import { useTranslation } from 'react-i18next';

import { Card, Screen, ScreenHeader, SectionHeader, Text } from '@/components/ui';
import { useTheme } from '@/theme';

/** Settings → About: data sources and attributions. */
export default function AboutScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const sections = [
    { title: t('about.weather'), body: t('about.weatherBody') },
    { title: t('about.model'), body: t('about.modelBody') },
    { title: t('about.ai'), body: t('about.aiBody') },
  ];
  return (
    <Screen header={<ScreenHeader back title={t('about.title')} large={false} />}>
      {sections.map((s) => (
        <Card key={s.title} style={{ gap: spacing.sm }}>
          <SectionHeader title={s.title} />
          <Text variant="body" color="inkMuted">
            {s.body}
          </Text>
        </Card>
      ))}
      <Text variant="caption" color="inkSubtle">
        {t('about.disclaimer')}
      </Text>
    </Screen>
  );
}
