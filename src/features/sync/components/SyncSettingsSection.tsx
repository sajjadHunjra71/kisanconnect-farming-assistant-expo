import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, View } from 'react-native';

import { Card, Divider, ListRow, SectionHeader } from '@/components/ui';
import { useSyncStore } from '@/store/sync-store';
import { discardFailed, requestSync } from '@/sync/sync-manager';
import { useTheme } from '@/theme';

import { SyncStatus } from './SyncStatus';

/** Settings → Sync: what's waiting, "Sync now", "Discard failed". Signed-in users only. */
export function SyncSettingsSection() {
  const { t } = useTranslation();
  const { spacing, colors } = useTheme();
  const pending = useSyncStore((s) => s.pending);
  const failed = useSyncStore((s) => s.failed.length);
  const [busy, setBusy] = useState(false);

  const subtitle = [pending > 0 ? t('sync.pending', { count: pending }) : null, failed > 0 ? t('sync.failed', { count: failed }) : null]
    .filter(Boolean)
    .join(' · ') || t('sync.allSynced');

  const syncNow = async () => {
    setBusy(true);
    await requestSync('full');
    setBusy(false);
  };

  const confirmDiscard = () =>
    Alert.alert(t('sync.discardTitle'), t('sync.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('sync.discard'), style: 'destructive', onPress: () => void discardFailed() },
    ]);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={t('sync.title')} />
      <Card style={{ paddingVertical: spacing.xs }}>
        <ListRow icon="cloud-sync-outline" iconTone="primarySoft" title={t('sync.title')} subtitle={subtitle} trailing={<SyncStatus />} chevron={false} />
        <Divider inset={52} />
        <ListRow
          icon="cloud-upload-outline"
          title={t('sync.syncNow')}
          onPress={busy ? undefined : syncNow}
          chevron={false}
          trailing={busy ? <ActivityIndicator color={colors.primary} /> : undefined}
        />
        {failed > 0 ? (
          <>
            <Divider inset={52} />
            <ListRow icon="delete-sweep-outline" iconTone="dangerSoft" title={t('sync.discardFailed')} destructive onPress={confirmDiscard} chevron={false} />
          </>
        ) : null}
      </Card>
    </View>
  );
}
