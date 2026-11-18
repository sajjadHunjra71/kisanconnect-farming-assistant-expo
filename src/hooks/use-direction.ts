import { useMemo } from 'react';
import type { TextStyle, ViewStyle } from 'react-native';

import { getLanguage } from '@/i18n/languages';
import { useSettingsStore } from '@/store/settings-store';

/**
 * Direction-aware layout helpers. We flip layout per component instead of
 * using I18nManager.forceRTL, so switching language is instant (no app reload).
 */
export function useDirection() {
  const language = useSettingsStore((s) => s.language);
  return useMemo(() => {
    const isRTL = getLanguage(language).dir === 'rtl';
    return {
      isRTL,
      language,
      row: (isRTL ? 'row-reverse' : 'row') as ViewStyle['flexDirection'],
      textAlign: (isRTL ? 'right' : 'left') as TextStyle['textAlign'],
      alignStart: (isRTL ? 'flex-end' : 'flex-start') as ViewStyle['alignItems'],
      alignEnd: (isRTL ? 'flex-start' : 'flex-end') as ViewStyle['alignItems'],
      /** Mirror a directional icon such as a chevron or arrow. */
      flipX: isRTL ? [{ scaleX: -1 }] : [],
    };
  }, [language]);
}
