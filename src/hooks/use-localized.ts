import { useCallback } from 'react';

import type { LanguageCode } from '@/i18n/languages';
import { useSettingsStore } from '@/store/settings-store';

/** Content that comes from data (crops, diseases, markets) carries every language. */
export type Localized = Record<'en', string> & Partial<Record<Exclude<LanguageCode, 'en'>, string>>;

export function useLocalized() {
  const language = useSettingsStore((s) => s.language);
  return useCallback((value: Localized) => value[language] ?? value.en, [language]);
}
