import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';

const SIZE = 240;

/** Camera placeholder with scan-line animation. */
export function Viewfinder({ hint }: { hint: string }) {
  const { colors, radius } = useTheme();
  const y = useSharedValue(0);

  useEffect(() => {
    y.value = withRepeat(withTiming(SIZE - 4, { duration: 2200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [y]);

  const line = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  const corner = { position: 'absolute' as const, width: 34, height: 34, borderColor: colors.accent };

  return (
    <View style={{ borderRadius: radius.xl, backgroundColor: '#13201A', alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 16, overflow: 'hidden' }}>
      <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
        <View style={[corner, { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 }]} />
        <View style={[corner, { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 }]} />
        <View style={[corner, { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 }]} />
        <View style={[corner, { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 }]} />
        <Icon name="leaf" size={110} tint="rgba(123,197,154,0.35)" />
        <Animated.View style={[{ position: 'absolute', top: 0, left: 12, right: 12, height: 3, borderRadius: 2, backgroundColor: colors.accent, opacity: 0.9 }, line]} />
      </View>
      <Text variant="label" style={{ color: 'rgba(255,255,255,0.75)' }} align="center">
        {hint}
      </Text>
    </View>
  );
}
