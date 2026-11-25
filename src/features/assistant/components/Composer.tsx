import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, cancelAnimation } from 'react-native-reanimated';

import { IconButton, Icon, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import { fontFamilies } from '@/theme/typography';

type Props = { onSend: (text: string) => void };

/** Text box + hold-to-talk mic. Voice input is planned (expo-speech-recognition). */
export function Composer({ onSend }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const pulse = useSharedValue(1);
  const ring = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));

  const startListening = () => {
    setListening(true);
    pulse.value = withRepeat(withTiming(1.6, { duration: 900 }), -1, false);
  };
  const stopListening = () => {
    setListening(false);
    cancelAnimation(pulse);
    pulse.value = 1;
  };

  const send = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {listening ? (
        <View style={{ flexDirection: row, alignItems: 'center', gap: 8, alignSelf: 'center' }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger }} />
          <Text variant="label" color="danger">
            {t('assistant.listening')}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: row, alignItems: 'center', gap: spacing.sm }}>
        <View
          style={{
            flex: 1,
            flexDirection: row,
            alignItems: 'center',
            minHeight: 56,
            borderRadius: radius.xl,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
          }}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.inkSubtle}
            accessibilityLabel={t('assistant.placeholder')}
            multiline
            style={{
              flex: 1,
              color: colors.ink,
              fontFamily: isRTL ? fontFamilies.urdu : fontFamilies.medium,
              fontSize: 16,
              textAlign: isRTL ? 'right' : 'left',
              maxHeight: 120,
              paddingVertical: 12,
            }}
            onSubmitEditing={send}
          />
          {text.trim() ? <IconButton icon="send" tone="clear" iconColor="primary" accessibilityLabel={t('assistant.send')} onPress={send} directional size={40} /> : null}
        </View>
        <Pressable
          onPressIn={startListening}
          onPressOut={stopListening}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.holdToTalk')}
          style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent }, ring, { opacity: listening ? 0.35 : 0 }]} />
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: listening ? colors.danger : colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="microphone" size={26} color="onAccent" />
          </View>
        </Pressable>
      </View>
      <Text variant="caption" color="inkSubtle" align="center">
        {t('assistant.holdToTalk')}
      </Text>
    </View>
  );
}
