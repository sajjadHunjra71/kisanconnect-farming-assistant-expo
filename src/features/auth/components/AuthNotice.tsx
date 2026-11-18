import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui';
import { isBackendConfigured } from '@/config/env';

/** Visible only in demo mode (no Supabase keys in .env). */
export function AuthNotice() {
  const { t } = useTranslation();
  if (isBackendConfigured) return null;
  return <Badge label={t('auth.notConnected')} tone="info" icon="information-outline" />;
}
