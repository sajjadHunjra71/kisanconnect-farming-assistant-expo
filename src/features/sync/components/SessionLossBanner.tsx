import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { useDirection } from '@/hooks/use-direction';
import { useSyncStore } from '@/store/sync-store';
import { useTheme } from '@/theme';

/** Shown when the session ended by itself while changes were still waiting to upload. */
export function SessionLossBanner() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { row } = useDirection();
  const loss = useSyncStore((s) => s.sessionLoss);
  if (!loss) return null;
  return (
    <Card tone="warningSoft" accessibilityLabel={t('sync.sessionLost', { count: loss.count })}>
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
        <Icon name="cloud-upload-outline" color="warning" />
        <Text variant="body" style={{ flex: 1 }}>
          {t('sync.sessionLost', { count: loss.count })}
        </Text>
      </View>
    </Card>
  );
}
