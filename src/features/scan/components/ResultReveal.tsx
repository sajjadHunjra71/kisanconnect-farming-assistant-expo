import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

/**
 * Scan result reveal, inspired by "card ready" moments: a scan line sweeps the photo,
 * then the result card pops in with a light glare and its content arrives in a stagger.
 */

/** A glowing line that sweeps the photo area twice, then calls onDone. */
export function ScanSweep({ height, onDone, color = '#E9C46A' }: { height: number; onDone: () => void; color?: string }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  const fade = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      onDone();
      return;
    }
    y.value = withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }), 2, true, () => {
      fade.value = withTiming(0, { duration: 200 }, (ok) => {
        if (ok) runOnJS(onDone)();
      });
    });
    // onDone is stable for the screen's lifetime; run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const line = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: interpolate(y.value, [0, 1], [0, height - 36]) }],
  }));
  const tint = useAnimatedStyle(() => ({ opacity: fade.value * 0.25 }));

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, tint]} />
      <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 36 }, line]}>
        <LinearGradient colors={['transparent', `${color}55`, 'transparent']} style={StyleSheet.absoluteFill} />
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 17,
            height: 2,
            backgroundColor: color,
          }}
        />
      </Animated.View>
    </View>
  );
}

/** Pops the card in (slight tilt + scale) and sweeps a glare across it once `revealed` turns true. */
export function RevealCard({ revealed, children, style }: { revealed: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(0);
  const glare = useSharedValue(0);
  const width = useSharedValue(0);

  useEffect(() => {
    if (!revealed) return;
    if (reduced) {
      pop.value = 1;
      return;
    }
    pop.value = withSequence(withTiming(-1, { duration: 120 }), withSpring(1, { damping: 12, stiffness: 160 }));
    glare.value = withDelay(180, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
  }, [revealed, reduced, pop, glare]);

  const card = useAnimatedStyle(() => ({
    transform: [{ perspective: 800 }, { scale: interpolate(pop.value, [-1, 0, 1], [0.97, 1, 1]) }, { rotateX: `${interpolate(pop.value, [-1, 0, 1], [6, 0, 0])}deg` }],
  }));
  const shine = useAnimatedStyle(() => ({
    opacity: interpolate(glare.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
    transform: [
      {
        translateX: interpolate(glare.value, [0, 1], [-160, width.value + 40]),
      },
      { rotate: '18deg' },
    ],
  }));

  return (
    <Animated.View style={[style, card]} onLayout={(e: LayoutChangeEvent) => (width.value = e.nativeEvent.layout.width)}>
      {children}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden', borderRadius: 20 }]}>
        <Animated.View style={[{ position: 'absolute', top: -60, bottom: -60, width: 90 }, shine]}>
          <LinearGradient colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

/** Fades + lifts its children into place once `revealed` is true, after `index` stagger steps. */
export function Reveal({ revealed, index = 0, children, style }: { revealed: boolean; index?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => {
    if (!revealed) return;
    v.value = reduced ? 1 : withDelay(120 + index * 70, withSpring(1, { damping: 18, stiffness: 140 }));
  }, [revealed, reduced, index, v]);
  const anim = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ translateY: interpolate(v.value, [0, 1], [14, 0]) }],
  }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
