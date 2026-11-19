import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Extrapolation,
  FadeInDown,
  FadeOutUp,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme';
import type { HourlyForecast } from '@/types/domain';
import { conditionIcon } from '../weather-icons';

/**
 * Day slider inspired by the "time slider" pattern: scrub a ruler of hours and the sky
 * cross-fades from dawn to night while the temperature rolls to the new value.
 * Everything runs on the UI thread (Reanimated scroll handler), so it stays smooth on low-end phones.
 */

const STEP = 56; // px between hour ticks
const HEIGHT = 340;

type Phase = 'dawn' | 'day' | 'dusk' | 'night';
const SKIES: Record<Phase, [string, string, string]> = {
  dawn: ['#3E4F7A', '#B9739A', '#F2B27A'],
  day: ['#1F5E9E', '#3C83C4', '#7FB6E0'],
  dusk: ['#2A2F5C', '#8A4B6E', '#E08A5C'],
  night: ['#060B1C', '#0F1B3A', '#1C2B52'],
};
const PHASES: Phase[] = ['dawn', 'day', 'dusk', 'night'];

function phaseOf(hour: number): Phase {
  if (hour < 9) return 'dawn';
  if (hour < 16) return 'day';
  if (hour < 19) return 'dusk';
  return 'night';
}

const hourNum = (h: HourlyForecast) => Number(h.hour.slice(0, 2));

function SkyLayer({ phase, progress, weights }: { phase: Phase; progress: SharedValue<number>; weights: number[] }) {
  const input = useMemo(() => weights.map((_, i) => i), [weights]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, weights, Extrapolation.CLAMP),
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient colors={SKIES[phase]} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: (i * 37) % 100,
  y: (i * 53) % 55,
  s: i % 3 === 0 ? 3 : 2,
}));

function Stars({ progress, weights }: { progress: SharedValue<number>; weights: number[] }) {
  const input = useMemo(() => weights.map((_, i) => i), [weights]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, weights, Extrapolation.CLAMP),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {STARS.map((st, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: `${st.x}%`,
            top: `${st.y}%`,
            width: st.s,
            height: st.s,
            borderRadius: 2,
            backgroundColor: 'rgba(255,255,255,0.8)',
          }}
        />
      ))}
    </Animated.View>
  );
}

function RainDrop({ x, delay, reduced }: { x: number; delay: number; reduced: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (!reduced) t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 900 }), -1, false));
  }, [delay, reduced, t]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(t.value, [0, 1], [-30, HEIGHT]) }, { rotate: '12deg' }],
    opacity: interpolate(t.value, [0, 0.1, 0.85, 1], [0, 0.7, 0.7, 0]),
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${x}%`,
          top: 0,
          width: 2,
          height: 18,
          borderRadius: 1,
          backgroundColor: 'rgba(200,225,255,0.9)',
        },
        style,
      ]}
    />
  );
}

function Rain({ progress, weights, reduced }: { progress: SharedValue<number>; weights: number[]; reduced: boolean }) {
  const input = useMemo(() => weights.map((_, i) => i), [weights]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, input, weights, Extrapolation.CLAMP),
  }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      {Array.from({ length: 16 }, (_, i) => (
        <RainDrop key={i} x={(i * 29 + 7) % 100} delay={(i * 137) % 900} reduced={reduced} />
      ))}
    </Animated.View>
  );
}

function SunMoon({ progress, count, width, isNight }: { progress: SharedValue<number>; count: number; width: SharedValue<number>; isNight: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = count > 1 ? progress.value / (count - 1) : 0;
    // Arc across the right half so the sun/moon never covers the temperature text.
    const x = interpolate(p, [0, 1], [width.value * 0.48, Math.max(16, width.value - 60)], Extrapolation.CLAMP);
    const y = 150 - Math.sin(p * Math.PI) * 120;
    return { transform: [{ translateX: x }, { translateY: y }] };
  });
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0 }, style]}>
      <Icon name={isNight ? 'moon-waning-crescent' : 'white-balance-sunny'} size={44} tint={isNight ? '#F3E9C6' : '#FFD66B'} />
    </Animated.View>
  );
}

function Tick({ index, progress, label }: { index: number; progress: SharedValue<number>; label: string }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      opacity: interpolate(d, [0, 3], [1, 0.35], Extrapolation.CLAMP),
      transform: [{ scaleY: interpolate(d, [0, 1], [1.6, 1], Extrapolation.CLAMP) }],
    };
  });
  return (
    <View style={{ width: STEP, alignItems: 'center', gap: 6 }}>
      <Animated.View style={[{ width: 2, height: 14, borderRadius: 1, backgroundColor: '#FFFFFF' }, style]} />
      <Text variant="caption" latin style={{ color: 'rgba(255,255,255,0.75)' }}>
        {label}
      </Text>
    </View>
  );
}

export function DaySkyCard({ hours, startIndex = 0 }: { hours: HourlyForecast[]; startIndex?: number }) {
  const { t } = useTranslation();
  const { radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const progress = useSharedValue(startIndex);
  const width = useSharedValue(0);
  const [cardWidth, setCardWidth] = useState(0);
  const [index, setIndex] = useState(startIndex);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const current = hours[index] ?? hours[0];

  const weights = useMemo(() => {
    const phaseWeights = Object.fromEntries(PHASES.map((p) => [p, hours.map((h) => (phaseOf(hourNum(h)) === p ? 1 : 0))])) as Record<Phase, number[]>;
    return {
      phase: phaseWeights,
      rain: hours.map((h) => Math.min(1, Math.max(0, (h.rainChance - 30) / 40))),
    };
  }, [hours]);

  const onScroll = useAnimatedScrollHandler((e) => {
    progress.value = Math.min(hours.length - 1, Math.max(0, e.contentOffset.x / STEP));
  });

  const tick = (i: number) => {
    setIndex(i);
    void Haptics.selectionAsync();
  };
  useAnimatedReaction(
    () => Math.round(progress.value),
    (i, prev) => {
      if (prev !== null && i !== prev) runOnJS(tick)(i);
    },
  );

  const onLayout = (e: LayoutChangeEvent) => {
    width.value = e.nativeEvent.layout.width;
    setCardWidth(e.nativeEvent.layout.width);
  };

  const side = Math.max(0, cardWidth / 2 - STEP / 2);
  const isNight = phaseOf(hourNum(current)) === 'night';

  return (
    <View
      onLayout={onLayout}
      style={{
        height: HEIGHT,
        borderRadius: radius.xl,
        overflow: 'hidden',
        backgroundColor: SKIES.day[0],
      }}>
      {PHASES.map((p) => (
        <SkyLayer key={p} phase={p} progress={progress} weights={weights.phase[p]} />
      ))}
      <Stars progress={progress} weights={weights.phase.night} />
      <SunMoon progress={progress} count={hours.length} width={width} isNight={isNight} />
      <Rain progress={progress} weights={weights.rain} reduced={reduced} />

      <View style={{ padding: spacing.xl, gap: 2 }} pointerEvents="none">
        <Text variant="label" latin style={{ color: 'rgba(255,255,255,0.8)' }}>
          {index === startIndex ? t('weather.now') : current.hour}
        </Text>
        <View style={{ height: 56, overflow: 'hidden' }}>
          <Animated.View key={`t-${current.tempC}`} entering={reduced ? undefined : FadeInDown.duration(220)} exiting={reduced ? undefined : FadeOutUp.duration(160)}>
            <Text variant="display" latin style={{ color: '#FFFFFF' }}>
              {current.tempC}°
            </Text>
          </Animated.View>
        </View>
        <Animated.View key={`c-${current.condition}`} entering={reduced ? undefined : FadeInDown.duration(220)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={conditionIcon[current.condition]} size={18} tint="#FFFFFF" />
          <Text variant="title" style={{ color: '#FFFFFF' }}>
            {t(`weather.conditions.${current.condition}`)}
          </Text>
        </Animated.View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
          }}>
          <Icon name="water" size={14} tint="rgba(200,225,255,0.95)" />
          <Text variant="caption" latin style={{ color: 'rgba(255,255,255,0.85)' }}>
            {t('weather.rainChance', { value: current.rainChance })}
          </Text>
        </View>
      </View>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: spacing.lg,
          gap: spacing.sm,
        }}>
        <Text variant="caption" align="center" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('weather.scrubHint')}
        </Text>
        {cardWidth > 0 ? (
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            snapToInterval={STEP}
            decelerationRate="fast"
            ref={scrollRef}
            // contentOffset is iOS-only, so jump to 'now' once the ruler has laid out.
            onContentSizeChange={() => scrollRef.current?.scrollTo({ x: startIndex * STEP, animated: false })}
            contentContainerStyle={{ paddingHorizontal: side }}
            accessibilityLabel={t('weather.scrubHint')}>
            {hours.map((h, i) => (
              <Tick key={h.hour} index={i} progress={progress} label={h.hour.slice(0, 2)} />
            ))}
          </Animated.ScrollView>
        ) : null}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: cardWidth / 2 - 1,
            bottom: 22,
            width: 2,
            height: 30,
            borderRadius: 1,
            backgroundColor: '#FFD66B',
          }}
        />
      </View>
    </View>
  );
}
