import { useEffect } from 'react';

import { useSettingsStore } from '@/store/settings-store';
import i18n from './index';

/** Keeps i18next in step with the persisted language setting (one tap in Settings switches everything). */
export function useLanguageSync() {
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    if (i18n.language !== language) void i18n.changeLanguage(language);
  }, [language]);
}
