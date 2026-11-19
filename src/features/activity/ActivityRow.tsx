import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/ui';
import type { ActivityRecord } from '@/db';
import { formatDate } from '@/features/farm/format';
import { useSettingsStore } from '@/store/settings-store';

import { ACTIVITY_META } from './meta';

export function formatPkr(amount: number, language: string): string {
  try {
    return amount.toLocaleString(language === 'ur' ? 'ur-PK' : 'en-PK', { maximumFractionDigits: 0 });
  } catch {
    return String(Math.round(amount));
  }
}

/** One activity in a list: icon by type, product, date · quantity · cost. */
export function ActivityRow({ activity, cropLabel, onPress }: { activity: ActivityRecord; cropLabel?: string; onPress?: () => void }) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const meta = ACTIVITY_META[activity.type];
  const title = [t(`activity.types.${activity.type}`), activity.product].filter(Boolean).join(' · ');
  const subtitle = [
    formatDate(activity.done_on, language),
    cropLabel,
    activity.quantity != null && activity.quantity_unit ? `${activity.quantity} ${t(`activity.units.${activity.quantity_unit}`)}` : null,
    activity.cost_pkr != null ? t('activity.cost', { amount: formatPkr(activity.cost_pkr, language) }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return <ListRow icon={meta.icon} iconTone={meta.tone} title={title} subtitle={subtitle} onPress={onPress} chevron={!!onPress} />;
}
