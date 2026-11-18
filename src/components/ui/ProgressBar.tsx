import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';

type Props = { value: number; height?: number; color?: string; track?: string };

export function ProgressBar({ value, height = 8, color, track }: Props) {
  const { colors } = useTheme();
  const { alignStart } = useDirection();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(Math.max(0, Math.min(1, value)), { duration: 700 });
  }, [value, progress]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? colors.surfaceAlt, overflow: 'hidden', alignItems: alignStart }}>
      <Animated.View style={[{ height, borderRadius: height, backgroundColor: color ?? colors.primary }, fill]} />
    </View>
  );
}
