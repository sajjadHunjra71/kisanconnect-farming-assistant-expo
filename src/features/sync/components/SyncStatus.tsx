import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useAuthStore } from '@/store/auth-store';
import { useSyncStore, type SyncStatus as Status } from '@/store/sync-store';
import type { Palette } from '@/theme/colors';

const ICON: Record<Status, { name: IconName; color: keyof Palette }> = {
  'saved-locally': { name: 'cellphone-check', color: 'inkMuted' },
  syncing: { name: 'cloud-sync-outline', color: 'primary' },
  synced: { name: 'cloud-check-outline', color: 'success' },
  offline: { name: 'cloud-off-outline', color: 'inkMuted' },
  error: { name: 'cloud-alert-outline', color: 'danger' },
};

/** Compact "Saved on phone / Syncing… / Synced" indicator. Hidden in demo mode. */
export function SyncStatus() {
  const { t } = useTranslation();
  const { row } = useDirection();
  const signedIn = useAuthStore((s) => s.status === 'signedIn');
  const status = useSyncStore((s) => s.status);
  if (!signedIn) return null;
  const icon = ICON[status];
  const label = t(`sync.status.${status}`);
  return (
    <View accessible accessibilityRole="text" accessibilityLabel={label} style={{ flexDirection: row, alignItems: 'center', gap: 4 }}>
      <Icon name={icon.name} size={16} color={icon.color} />
      <Text variant="caption" color="inkMuted">
        {label}
      </Text>
    </View>
  );
}
