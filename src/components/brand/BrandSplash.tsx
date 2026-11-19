import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
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
import { BRAND, LOGO_MARK } from './art';

/**
 * Launch animation inspired by "burst" splash screens: on a harvest-yellow screen, 3D farm objects
 * fly out from behind the logo to their spots, float for a moment, then everything shrinks away
 * while the logo lifts and the app fades in underneath. ~3.3 s, tap to skip, honours Reduce Motion.
 */

// Cloud, tractor and cotton are our own renders; the rest are Microsoft Fluent Emoji 3D (MIT, see assets/images/splash/LICENSE.md).
const IMAGES = {
  sunCloud: require('../../../assets/images/splash/sun_cloud.png'),
  cloud: require('../../../assets/images/splash/cloud.png'),
  cotton: require('../../../assets/images/splash/cotton.png'),
  droplet: require('../../../assets/images/splash/droplet.png'),
  wheat: require('../../../assets/images/splash/wheat.png'),
  tractor: require('../../../assets/images/splash/tractor.png'),
  corn: require('../../../assets/images/splash/corn.png'),
  chili: require('../../../assets/images/splash/chili.png'),
  seedling: require('../../../assets/images/splash/seedling.png'),
  leaf: require('../../../assets/images/splash/leaf.png'),
  sunflower: require('../../../assets/images/splash/sunflower.png'),
  buffalo: require('../../../assets/images/splash/buffalo.png'),
  mango: require('../../../assets/images/splash/mango.png'),
  tomato: require('../../../assets/images/splash/tomato.png'),
  money: require('../../../assets/images/splash/money.png'),
  carrot: require('../../../assets/images/splash/carrot.png'),
  sparkles: require('../../../assets/images/splash/sparkles.png'),
} as const;

type Placement = { name: keyof typeof IMAGES; x: number; y: number; size: number; rotate: number };

// x/y are fractions of the screen; the layout keeps the centre clear for the logo.
const PLACEMENTS: Placement[] = [
  { name: 'sunCloud', x: 0.78, y: 0.11, size: 112, rotate: 0 },
  { name: 'cloud', x: 0.22, y: 0.1, size: 120, rotate: 0 },
  { name: 'droplet', x: 0.5, y: 0.17, size: 50, rotate: 12 },
  { name: 'wheat', x: 0.12, y: 0.3, size: 96, rotate: -14 },
  { name: 'tractor', x: 0.8, y: 0.33, size: 150, rotate: 4 },
  { name: 'leaf', x: 0.36, y: 0.27, size: 64, rotate: 10 },
  { name: 'mango', x: 0.66, y: 0.24, size: 58, rotate: -18 },
  { name: 'sunflower', x: 0.12, y: 0.55, size: 92, rotate: 12 },
  { name: 'corn', x: 0.88, y: 0.56, size: 92, rotate: -14 },
  { name: 'tomato', x: 0.24, y: 0.69, size: 62, rotate: -10 },
  { name: 'chili', x: 0.76, y: 0.7, size: 66, rotate: 22 },
  { name: 'buffalo', x: 0.2, y: 0.84, size: 112, rotate: 0 },
  { name: 'money', x: 0.8, y: 0.83, size: 90, rotate: 8 },
  { name: 'seedling', x: 0.5, y: 0.9, size: 80, rotate: 0 },
  { name: 'carrot', x: 0.9, y: 0.93, size: 58, rotate: -20 },
  { name: 'cotton', x: 0.5, y: 0.7, size: 84, rotate: -8 },
  { name: 'sparkles', x: 0.56, y: 0.38, size: 40, rotate: 0 },
];

const LOGO = 112;
const BURST_AT = 260; // logo squash before the burst
const HOLD_MS = 2300; // time from burst to exit
const EXIT_MS = 750;
const LOAD_TIMEOUT = 1500; // start anyway if an image is slow to decode

function BurstObject({ p, index, burst, exit, float, width, height, onLoad }: { p: Placement; index: number; burst: SharedValue<number>; exit: SharedValue<number>; float: SharedValue<number>; width: number; height: number; onLoad: () => void }) {
  const dx = p.x * width - width / 2;
  const dy = p.y * height - height / 2;
  const delay = index * 0.03; // stagger as a fraction of the burst
  const style = useAnimatedStyle(() => {
    const t = Math.min(1, Math.max(0, (burst.value - delay) / (1 - delay)));
    const bob = Math.sin(float.value * Math.PI * 2 + index) * 5;
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
      <Image source={IMAGES[p.name]} style={{ width: p.size, height: p.size }} contentFit="contain" transition={0} cachePolicy="memory" onLoad={onLoad} onError={onLoad} />
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

  // Wait until every object image is decoded, so nothing pops in half-way through the burst.
  const [loaded, setLoaded] = useState(false);
  const count = useRef(0);
  const onImageLoad = () => {
    count.current += 1;
    if (count.current >= PLACEMENTS.length) setLoaded(true);
  };
  useEffect(() => {
    const id = setTimeout(() => setLoaded(true), LOAD_TIMEOUT);
    return () => clearTimeout(id);
  }, []);

  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    exit.value = withTiming(1, { duration: EXIT_MS, easing: Easing.inOut(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(onDone)();
    });
  };

  useEffect(() => {
    if (!loaded) return;
    if (reduced) {
      burst.value = 1;
      word.value = 1;
      const id = setTimeout(finish, 900);
      return () => clearTimeout(id);
    }
    logo.value = withSequence(withTiming(0.84, { duration: BURST_AT, easing: Easing.out(Easing.quad) }), withSpring(1, { damping: 8, stiffness: 160 }));
    burst.value = withDelay(BURST_AT, withSpring(1, { damping: 15, stiffness: 70, mass: 1 }));
    word.value = withDelay(BURST_AT + 380, withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }));
    float.value = withDelay(BURST_AT + 700, withRepeat(withTiming(1, { duration: 3200, easing: Easing.linear }), -1));
    const hap = setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), BURST_AT);
    const id = setTimeout(finish, BURST_AT + HOLD_MS);
    return () => {
      clearTimeout(id);
      clearTimeout(hap);
    };
    // Starts once, when the images are ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

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
          <BurstObject key={`${p.name}-${i}`} p={p} index={i} burst={burst} exit={exit} float={float} width={width} height={height} onLoad={onImageLoad} />
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
