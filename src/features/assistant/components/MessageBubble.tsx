import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { Icon, PressableScale, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type Props = { role: 'farmer' | 'assistant'; text: string; sources?: string[] };

export function MessageBubble({ role, text, sources }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row, alignStart, alignEnd, isRTL } = useDirection();
  const mine = role === 'farmer';
  // Farmer bubbles sit on the "end" side, assistant on the "start" side.
  const align = mine ? alignEnd : alignStart;
  const tail = mine ? (isRTL ? 'borderBottomLeftRadius' : 'borderBottomRightRadius') : isRTL ? 'borderBottomRightRadius' : 'borderBottomLeftRadius';

  return (
    <Animated.View entering={FadeInUp.duration(250)} style={{ alignItems: align, gap: 6 }}>
      {!mine ? (
        <View style={{ flexDirection: row, alignItems: 'center', gap: 6 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sprout" size={13} color="onPrimary" />
          </View>
          <Text variant="caption" color="inkMuted" latin>
            KisanConnect AI
          </Text>
        </View>
      ) : null}
      <View
        style={{
          maxWidth: '86%',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          [tail]: 6,
          backgroundColor: mine ? colors.primary : colors.surface,
          borderWidth: mine ? 0 : 1,
          borderColor: colors.border,
          gap: spacing.sm,
        }}>
        <Text variant="body" color={mine ? 'onPrimary' : 'ink'}>
          {text}
        </Text>
        {sources?.length ? (
          <View style={{ gap: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text variant="overline" color="inkSubtle">
              {t('assistant.sources')}
            </Text>
            {sources.map((s) => (
              <View key={s} style={{ flexDirection: row, gap: 6, alignItems: 'center' }}>
                <Icon name="book-open-variant" size={14} color="primary" />
                <Text variant="caption" color="primary" latin style={{ flex: 1 }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {!mine ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={t('assistant.listen')} style={{ flexDirection: row, alignItems: 'center', gap: 4, paddingVertical: 4 }}>
          <Icon name="volume-high" size={16} color="inkMuted" />
          <Text variant="caption" color="inkMuted">
            {t('assistant.listen')}
          </Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
}
