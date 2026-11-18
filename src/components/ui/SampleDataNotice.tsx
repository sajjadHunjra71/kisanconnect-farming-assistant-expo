import { useTranslation } from 'react-i18next';

import { Badge } from './Badge';

/** Marks screens that still show placeholder data, so nothing looks "live" before it is wired up. */
export function SampleDataNotice() {
  const { t } = useTranslation();
  return <Badge label={t('common.sampleData')} tone="accent" icon="flask-outline" />;
}
