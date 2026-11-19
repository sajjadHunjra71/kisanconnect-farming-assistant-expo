import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui';
import type { SyncTable } from '@/db/types';
import { conflictFor } from '@/store/sync-store';
import { useSyncStore } from '@/store/sync-store';

/** "Updated from another device" tag for a row whose local edit lost a sync conflict. */
export function UpdatedElsewhereNote({ table, id }: { table: SyncTable; id: string }) {
  const { t } = useTranslation();
  const note = useSyncStore(conflictFor(table, id));
  if (!note) return null;
  return <Badge label={t('sync.updatedElsewhere')} tone="info" icon="cellphone-arrow-down" />;
}
