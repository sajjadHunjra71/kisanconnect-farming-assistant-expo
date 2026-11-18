import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Chip, Icon, ScreenHeader, TAB_BAR_SPACE, Text } from '@/components/ui';
import { Composer, MessageBubble } from '@/features/assistant/components';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { CROPS, currentStage } from '@/mocks/crops';
import { sampleChat, sampleFarm, sampleWeatherNow } from '@/mocks/sample-data';
import { useTheme } from '@/theme';

type Msg = { id: string; role: 'farmer' | 'assistant'; text: string; sources?: string[] };

export default function AssistantScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { row } = useDirection();
  const l = useLocalized();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [extra, setExtra] = useState<Msg[]>([]);

  const crop = sampleFarm.crops[0];
  const { stage } = currentStage(crop.cropId, crop.sowingDate);
  const context = `${l(CROPS[crop.cropId].name)} · ${l(stage.name)} · ${l(sampleFarm.district)} · ${sampleWeatherNow.tempC}°`;

  const messages: Msg[] = [...sampleChat.map((m) => ({ id: m.id, role: m.role, text: l(m.text), sources: m.sources })), ...extra];
  const suggestions = [t('assistant.suggestions.yellow'), t('assistant.suggestions.urea'), t('assistant.suggestions.rain'), t('assistant.suggestions.rust')];

  const send = (text: string) => {
    const id = String(Date.now());
    setExtra((m) => [...m, { id, role: 'farmer', text }, { id: `${id}-r`, role: 'assistant', text: t('common.comingSoon') }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, paddingTop: insets.top + spacing.sm }}>
        <ScreenHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
          <View style={{ flexDirection: row, alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.primarySoft }}>
            <Icon name="map-marker-radius-outline" size={18} color="primary" />
            <Text variant="label" color="primary" style={{ flex: 1 }} numberOfLines={1}>
              {context}
            </Text>
          </View>
        </View>

        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.lg, paddingBottom: spacing.lg }} keyboardShouldPersistTaps="handled">
          <Badge label={t('common.sampleData')} tone="accent" icon="flask-outline" />
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} text={m.text} sources={m.sources} />
          ))}
          <View style={{ gap: spacing.sm }}>
            <Text variant="overline" color="inkSubtle">
              {t('assistant.suggestionsTitle')}
            </Text>
            <View style={{ flexDirection: row, flexWrap: 'wrap', gap: spacing.sm }}>
              {suggestions.map((s) => (
                <Chip key={s} label={s} onPress={() => send(s)} />
              ))}
            </View>
          </View>
          <Text variant="caption" color="inkSubtle" align="center">
            {t('assistant.disclaimer')}
          </Text>
        </ScrollView>

        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: TAB_BAR_SPACE + Math.max(insets.bottom, 12) - 8, backgroundColor: colors.background }}>
          <Composer onSend={send} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
