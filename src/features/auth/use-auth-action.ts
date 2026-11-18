import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthServiceError } from '@/lib/supabase';

/** Runs an auth call with loading + a translated error message. */
export function useAuthAction() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      const code = e instanceof AuthServiceError ? e.code : 'unknown';
      if (code !== 'cancelled') setError(t(`auth.errors.${code}`));
      return undefined;
    } finally {
      setLoading(false);
    }
  };

  return { run, loading, error, setError };
}
