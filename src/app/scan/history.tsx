import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Divider, EmptyState, ListRow, Screen, ScreenHeader, type IconName } from '@/components/ui';
import { CROP_CALENDARS, kbEntry } from '@/engine';
import { formatDate, localDay } from '@/features/farm/format';
import { useRepoQuery } from '@/features/farm/hooks';
import { useLocalized } from '@/hooks/use-localized';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';

/** All scans on this phone (synced across the user's phones). Works offline. */
export default function ScanHistoryScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const l = useLocalized();
  const language = useSettingsStore((s) => s.language);
  const { data } = useRepoQuery(async (r) => ({ scans: await r.scansRepo.list(), states: await r.scanQueue.list() }), []);

  return (
    <Screen header={<ScreenHeader back title={t('scan.history')} large={false} />}>
      {data && data.scans.length === 0 ? <EmptyState icon="leaf" title={t('scan.noScans')} actionLabel={t('scan.takePhoto')} onAction={() => router.replace('/(tabs)/scan')} /> : null}
      {data && data.scans.length > 0 ? (
        <Card style={{ paddingVertical: spacing.xs }}>
          {data.scans.map((s, i) => {
            const st = data.states.find((x) => x.scan_id === s.id)?.check_state;
            const top = kbEntry(s.top_disease_id);
            const status = s.final_status ? t(`scan.status.${s.final_status}`) : st ? t(`scan.state.${st}`) : '';
            return (
              <View key={s.id}>
                {i > 0 ? <Divider inset={52} /> : null}
                <ListRow
                  icon={CROP_CALENDARS[s.crop_key].icon as IconName}
                  iconTone="accentSoft"
                  title={[l(CROP_CALENDARS[s.crop_key].name), top ? l(top.name) : null].filter(Boolean).join(' · ')}
                  subtitle={`${formatDate(localDay(s.created_at), language)} · ${status}`}
                  onPress={() => router.push({ pathname: '/scan/[id]', params: { id: s.id } })}
                />
              </View>
            );
          })}
        </Card>
      ) : null}
    </Screen>
  );
}
