import { View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { LANGUAGES } from '@/i18n/languages';
import { useSettingsStore } from '@/store/settings-store';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/typography';

/** One tap switches the whole app, including layout direction. */
export function LanguagePicker() {
  const { colors, radius, spacing } = useTheme();
  const { row } = useDirection();
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      {LANGUAGES.map((lang) => {
        const active = lang.code === language;
        return (
          <PressableScale
            key={lang.code}
            onPress={() => setLanguage(lang.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={lang.englishName}
            style={{
              flexDirection: row,
              alignItems: 'center',
              gap: spacing.md,
              minHeight: 64,
              paddingHorizontal: spacing.lg,
              borderRadius: radius.lg,
              borderWidth: 2,
              borderColor: active ? colors.primary : colors.border,
              backgroundColor: active ? colors.primarySoft : colors.surface,
            }}>
            <View style={{ flex: 1 }}>
              <Text
                variant="h3"
                latin
                style={lang.dir === 'rtl' ? { fontFamily: fontFamilies.urduBold, fontSize: 20, lineHeight: 46, paddingTop: 4, writingDirection: 'rtl' } : undefined}>
                {lang.nativeName}
              </Text>
              {lang.nativeName !== lang.englishName ? (
                <Text variant="caption" latin color="inkMuted">
                  {lang.englishName}
                </Text>
              ) : null}
            </View>
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 13,
                borderWidth: 2,
                borderColor: active ? colors.primary : colors.border,
                backgroundColor: active ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              {active ? <Icon name="check" size={16} color="onPrimary" /> : null}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
