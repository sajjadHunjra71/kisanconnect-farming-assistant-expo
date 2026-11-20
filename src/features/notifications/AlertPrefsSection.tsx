import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { Card, Chip, Divider, FormError, ListRow, SectionHeader, Text, Toggle } from '@/components/ui';
import { ALERT_PREF_KINDS, normalizePrefs, type NotificationPrefs } from '@/engine';
import { useDirection } from '@/hooks/use-direction';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth-store';
import { useTheme } from '@/theme';

const STARTS = ['20:00', '21:00', '22:00', '23:00'];
const ENDS = ['05:00', '06:00', '07:00', '08:00'];

/** Settings → which weather alerts to receive, and quiet hours (saved in profiles.notification_prefs). */
export function AlertPrefsSection() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const profile = useAuthStore((s) => s.profile);
  const loadProfile = useAuthStore((s) => s.loadProfile);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() => normalizePrefs(profile?.notification_prefs));
  const [error, setError] = useState<string | null>(null);

  const save = async (next: NotificationPrefs) => {
    const prev = prefs;
    setPrefs(next);
    setError(null);
    const userId = useAuthStore.getState().session?.user.id;
    if (!supabase || !userId) return;
    const { error: e } = await supabase.from('profiles').update({ notification_prefs: next }).eq('id', userId);
    if (e) {
      setPrefs(prev);
      setError(t('alerts.saveFailed'));
    } else void loadProfile();
  };

  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeader title={t('alerts.settingsTitle')} />
      <FormError message={error} />
      <Card style={{ paddingVertical: spacing.xs }}>
        {ALERT_PREF_KINDS.map((k, i) => (
          <View key={k}>
            {i > 0 ? <Divider inset={16} /> : null}
            <ListRow
              title={t(`alerts.kinds.${k}`)}
              chevron={false}
              trailing={<Toggle value={prefs.kinds[k]} accessibilityLabel={t(`alerts.kinds.${k}`)} onValueChange={(v) => void save({ ...prefs, kinds: { ...prefs.kinds, [k]: v } })} />}
            />
          </View>
        ))}
      </Card>
      <Card style={{ gap: spacing.sm }}>
        <Text variant="title">{t('alerts.quietHours')}</Text>
        <Text variant="caption" color="inkMuted">
          {t('alerts.quietBody')}
        </Text>
        {(['start', 'end'] as const).map((edge) => (
          <View key={edge} style={{ gap: spacing.xs }}>
            <Text variant="label">{edge === 'start' ? t('alerts.quietFrom') : t('alerts.quietTo')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: row, gap: spacing.sm }}>
              {(edge === 'start' ? STARTS : ENDS).map((v) => (
                <Chip key={v} label={v} selected={prefs.quiet_hours[edge] === v} onPress={() => void save({ ...prefs, quiet_hours: { ...prefs.quiet_hours, [edge]: v } })} />
              ))}
            </ScrollView>
          </View>
        ))}
      </Card>
    </View>
  );
}
