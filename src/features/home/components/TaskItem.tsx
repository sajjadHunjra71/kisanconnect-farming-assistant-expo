import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { Burst, PressableScale, Text } from '@/components/ui';
import { useDirection } from '@/hooks/use-direction';
import { useLocalized } from '@/hooks/use-localized';
import { useTheme } from '@/theme';
import type { FarmTask } from '@/types/domain';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const BOX = 28;
const CHECK_LENGTH = 20;

/**
 * Farm task row with a small reward when completed: the box pops, the tick draws itself,
 * a confetti burst fires and "+1" floats up (inspired by progress/reward moments).
 */
export function TaskItem({ task }: { task: FarmTask }) {
  const { colors, radius, spacing } = useTheme();
  const { row, isRTL } = useDirection();
  const l = useLocalized();
  const reduced = useReducedMotion();
  const [done, setDone] = useState(task.done);
  const [burst, setBurst] = useState(0);

  const checked = useSharedValue(task.done ? 1 : 0);
  const pop = useSharedValue(1);
  const plus = useSharedValue(0);

  useEffect(() => {
    checked.value = reduced ? (done ? 1 : 0) : withTiming(done ? 1 : 0, { duration: done ? 320 : 160 });
  }, [done, reduced, checked]);

  const toggle = () => {
    const next = !done;
    setDone(next);
    if (!next) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduced) return;
    setBurst((b) => b + 1);
    pop.value = withSequence(withTiming(1.22, { duration: 110 }), withSpring(1, { damping: 9, stiffness: 220 }));
    plus.value = 0;
    plus.value = withTiming(1, { duration: 900 });
  };

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
    backgroundColor: interpolateColor(checked.value, [0, 1], ['rgba(0,0,0,0)', colors.primary]),
    borderColor: interpolateColor(checked.value, [0, 1], [colors.border, colors.primary]),
  }));
  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - checked.value),
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(checked.value, [0, 1], [1, 0.5]),
  }));
  const plusStyle = useAnimatedStyle(() => ({
    opacity: interpolate(plus.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
    transform: [{ translateY: interpolate(plus.value, [0, 1], [4, -26]) }, { scale: interpolate(plus.value, [0, 0.2, 1], [0.6, 1.1, 1]) }],
  }));

  return (
    <PressableScale
      onPress={toggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done }}
      accessibilityLabel={l(task.title)}
      scaleTo={0.98}
      style={{
        flexDirection: row,
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
      }}>
      <View style={{ width: BOX, height: BOX }}>
        <Burst trigger={burst} size={BOX} colors={[colors.primary, colors.accent, colors.info, colors.danger]} />
        <Animated.View
          style={[
            {
              width: BOX,
              height: BOX,
              borderRadius: 9,
              borderWidth: 2,
              alignItems: 'center',
              justifyContent: 'center',
            },
            boxStyle,
          ]}>
          <Svg width={18} height={18} viewBox="0 0 18 18">
            <AnimatedPath
              d="M3.5 9.5 L7.5 13 L14.5 5"
              stroke={colors.onPrimary}
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              strokeDasharray={CHECK_LENGTH}
              animatedProps={tickProps}
            />
          </Svg>
        </Animated.View>
      </View>
      <Animated.View style={[{ flex: 1, gap: 2 }, textStyle]}>
        <Text variant="bodyStrong" style={{ textDecorationLine: done ? 'line-through' : 'none' }}>
          {l(task.title)}
        </Text>
        <Text variant="caption" color="inkMuted">
          {l(task.detail)}
        </Text>
      </Animated.View>
      <View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: colors.surfaceAlt,
          }}>
          <Text variant="caption" color="inkMuted">
            {l(task.due)}
          </Text>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: -6,
              ...(isRTL ? { left: 4 } : { right: 4 }),
            },
            plusStyle,
          ]}>
          <Text variant="label" latin style={{ color: colors.primary }}>
            +1
          </Text>
        </Animated.View>
      </View>
    </PressableScale>
  );
}
