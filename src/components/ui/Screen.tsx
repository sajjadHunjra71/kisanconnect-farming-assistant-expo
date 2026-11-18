import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom space so content clears the floating tab bar. */
  withTabBar?: boolean;
  padded?: boolean;
  edges?: { top?: boolean; bottom?: boolean };
  contentStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
  footer?: ReactNode;
  keyboard?: boolean;
};

export const TAB_BAR_SPACE = 104;

export function Screen({
  children,
  scroll = true,
  withTabBar = false,
  padded = true,
  edges = { top: true, bottom: true },
  contentStyle,
  header,
  footer,
  keyboard = false,
}: ScreenProps) {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const paddingTop = edges.top ? insets.top + spacing.sm : 0;
  const paddingBottom = (withTabBar ? TAB_BAR_SPACE : 0) + (edges.bottom ? insets.bottom + spacing.lg : spacing.lg);
  const inner: StyleProp<ViewStyle> = [{ paddingHorizontal: padded ? spacing.xl : 0, gap: spacing.xl }, contentStyle];

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[inner, { paddingBottom: footer ? spacing.lg : paddingBottom }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, inner, { paddingBottom: footer ? 0 : paddingBottom }]}>{children}</View>
  );

  const content = (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop }}>
      {header}
      <View style={{ flex: 1 }}>{body}</View>
      {footer ? (
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: (withTabBar ? TAB_BAR_SPACE : 0) + insets.bottom + spacing.md }}>
          {footer}
        </View>
      ) : null}
    </View>
  );

  return keyboard ? (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  ) : (
    content
  );
}
