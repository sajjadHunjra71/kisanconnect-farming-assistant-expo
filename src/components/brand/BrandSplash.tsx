import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { Text } from '@/components/ui';
import { BRAND, LOGO_MARK, OBJECTS, type FarmObject } from './art';

/**
 * Launch animation inspired by "burst" splash screens: on a harvest-yellow screen, farm objects
 * fly out from behind the logo to their spots, float for a moment, then everything shrinks away
 * while the logo lifts and the app fades in underneath. ~2.3 s, tap to skip, honours Reduce Motion.
 */

type Placement = { name: FarmObject; x: number; y: number; size: number; rotate: number };

// x/y are fractions of the screen; the layout keeps the centre clear for the logo.
const PLACEMENTS: Placement[] = [
  { name: 'sun', x: 0.8, y: 0.12, size: 104, rotate: 0 },
  { name: 'cloudRain', x: 0.2, y: 0.1, size: 96, rotate: -8 },
  { name: 'wheat', x: 0.1, y: 0.33, size: 92, rotate: -18 },
  { name: 'tractor', x: 0.84, y: 0.36, size: 100, rotate: 8 },
  { name: 'cotton', x: 0.48, y: 0.2, size: 70, rotate: 10 },
  { name: 'drop', x: 0.62, y: 0.27, size: 44, rotate: 14 },
  { name: 'leaf', x: 0.16, y: 0.6, size: 84, rotate: 20 },
  { name: 'corn', x: 0.86, y: 0.62, size: 88, rotate: -16 },
  { name: 'chili', x: 0.32, y: 0.79, size: 76, rotate: -24 },
  { name: 'can', x: 0.74, y: 0.83, size: 92, rotate: 6 },
  { name: 'sprout', x: 0.12, y: 0.88, size: 84, rotate: -6 },
  { name: 'coin', x: 0.52, y: 0.92, size: 56, rotate: 12 },
  { name: 'sparkle', x: 0.3, y: 0.24, size: 26, rotate: 0 },
  { name: 'sparkle', x: 0.7, y: 0.7, size: 22, rotate: 0 },
  { name: 'sparkle', x: 0.9, y: 0.92, size: 18, rotate: 0 },
  { name: 'dot', x: 0.36, y: 0.42, size: 10, rotate: 0 },
  { name: 'dot', x: 0.66, y: 0.58, size: 12, rotate: 0 },
  { name: 'dot', x: 0.06, y: 0.74, size: 9, rotate: 0 },
];

const LOGO = 112;
const BURST_AT = 120;
const EXIT_AT = 1500;
const EXIT_MS = 520;

function BurstObject({ p, index, burst, exit, float, width, height }: { p: Placement; index: number; burst: SharedValue<number>; exit: SharedValue<number>; float: SharedValue<number>; width: number; height: number }) {
  const dx = p.x * width - width / 2;
  const dy = p.y * height - height / 2;
  const delay = index * 0.025; // stagger as a fraction of the burst
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (burst.value - delay) / (1 - delay)));
    const bob = Math.sin(float.value * Math.PI * 2 + index) * 4;
    return {
      opacity: interpolate(t, [0, 0.15], [0, 1]) * (1 - exit.value),
      transform: [
        { translateX: dx * t },
        { translateY: dy * t + bob },
        { rotate: `${p.rotate * t + (1 - t) * -40}deg` },
        { scale: interpolate(t, [0, 1], [0.2, 1]) * interpolate(exit.value, [0, 1], [1, 0.6]) },
      ],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[styles.center, { width: p.size, height: p.size, marginLeft: -p.size / 2, marginTop: -p.size / 2 }, style]}>
      <SvgXml xml={OBJECTS[p.name]} width={p.size} height={p.size} />
    </Animated.View>
  );
}

export function BrandSplash({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const logo = useSharedValue(1);
  const burst = useSharedValue(0);
  const float = useSharedValue(0);
  const exit = useSharedValue(0);
  const word = useSharedValue(0);

  const finish = () => {
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(onDone)();
    });
  };

  useEffect(() => {
    if (reduced) {
      burst.value = 1;
      word.value = 1;
      const id = setTimeout(finish, 700);
      return () => clearTimeout(id);
    }
    logo.value = withSequence(withTiming(0.86, { duration: BURST_AT }), withSpring(1, { damping: 7, stiffness: 180 }));
    burst.value = withDelay(BURST_AT, withSpring(1, { damping: 13, stiffness: 90, mass: 0.9 }));
    word.value = withDelay(BURST_AT + 260, withTiming(1, { duration: 360 }));
    float.value = withDelay(BURST_AT + 500, withRepeat(withTiming(1, { duration: 2400, easing: Easing.linear }), -1));
    const hap = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), BURST_AT);
    const id = setTimeout(finish, EXIT_AT);
    return () => {
      clearTimeout(id);
      clearTimeout(hap);
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bg = useAnimatedStyle(() => ({ opacity: interpolate(exit.value, [0, 0.4, 1], [1, 1, 0]) }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 0.6, 1], [1, 1, 0]),
    transform: [{ translateY: interpolate(exit.value, [0, 1], [0, -height * 0.32]) }, { scale: logo.value * interpolate(exit.value, [0, 1], [1, 0.45]) }],
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value * (1 - exit.value), transform: [{ translateY: interpolate(word.value, [0, 1], [10, 0]) }] }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 1000 }, bg]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: BRAND.splash }]} onPress={finish} accessibilityRole="button" accessibilityLabel="KisanConnect">
        {PLACEMENTS.map((p, i) => (
          <BurstObject key={`${p.name}-${i}`} p={p} index={i} burst={burst} exit={exit} float={float} width={width} height={height} />
        ))}
        <Animated.View style={[styles.center, { width: LOGO, height: LOGO, marginLeft: -LOGO / 2, marginTop: -LOGO / 2 }, logoStyle]}>
          <View style={styles.logoShadow}>
            <SvgXml xml={LOGO_MARK} width={LOGO} height={LOGO} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.center, { width: 260, marginLeft: -130, marginTop: LOGO / 2 + 14, alignItems: 'center' }, wordStyle]}>
          <View style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: BRAND.cream }}>
            <Text variant="h3" latin style={{ color: BRAND.green }}>
              KisanConnect
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', left: '50%', top: '50%' },
  logoShadow: { borderRadius: 34, shadowColor: '#5A3B00', shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
});
