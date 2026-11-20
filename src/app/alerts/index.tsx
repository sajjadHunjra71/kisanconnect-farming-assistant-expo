import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Badge, Button, Card, EmptyState, Screen, ScreenHeader, Text } from '@/components/ui';
import { formatDate } from '@/features/farm/format';
import { useRepoQuery } from '@/features/farm/hooks';
import { useDirection } from '@/hooks/use-direction';
import { useDataVersion } from '@/store/data-version';
import { useSettingsStore } from '@/store/settings-store';
import { requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

/** Inbox of weather alerts for the user's farms. Tap to mark read. */
export default function AlertsScreen() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const { row } = useDirection();
  const language = useSettingsStore((s) => s.language);
  const { data, repos } = useRepoQuery((r) => r.alertsLocal.list(), []);
  const unread = (data ?? []).filter((a) => !a.read_at).map((a) => a.id);

  const markRead = async (ids: string[]) => {
    if (!repos || ids.length === 0) return;
    await repos.alertsLocal.markRead(ids, new Date().toISOString());
    useDataVersion.getState().bump();
    void requestSync('full'); // sends the read marks when online; kept on the phone until then
  };

  return (
    <Screen
      header={<ScreenHeader back title={t('alerts.title')} large={false} />}
      footer={unread.length > 0 ? <Button label={t('alerts.markAll')} icon="check-all" variant="secondary" onPress={() => void markRead(unread)} /> : undefined}>
      {data && data.length === 0 ? <EmptyState icon="bell-check-outline" title={t('alerts.empty')} /> : null}
      {(data ?? []).map((a) => (
        <Card key={a.id} onPress={a.read_at ? undefined : () => void markRead([a.id])} accessibilityLabel={`${a.title}. ${a.body}`} style={{ gap: spacing.xs, opacity: a.read_at ? 0.7 : 1 }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
            {!a.read_at ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} /> : null}
            <Text variant="title" style={{ flex: 1 }}>
              {a.title}
            </Text>
            <Badge label={t('alerts.forDate', { date: formatDate(a.start_date, language) })} tone={a.severity === 'danger' ? 'danger' : 'warning'} />
          </View>
          <Text variant="body" color="inkMuted">
            {a.body}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
