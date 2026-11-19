import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

/**
 * A small confetti burst. Bump `trigger` (e.g. a counter) to fire it.
 * 10 pieces, ~600 ms, transforms only, so it stays cheap on low-end phones.
 */

type Piece = {
  angle: number;
  distance: number;
  color: string;
  size: number;
  spin: number;
};

function Bit({ piece, t }: { piece: Piece; t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = interpolate(t.value, [0, 1], [0, piece.distance]);
    return {
      opacity: interpolate(t.value, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(piece.angle) * d },
        {
          translateY: Math.sin(piece.angle) * d + interpolate(t.value, [0, 1], [0, 10]),
        },
        { rotate: `${t.value * piece.spin}deg` },
        { scale: interpolate(t.value, [0, 0.2, 1], [0.4, 1, 0.7]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: piece.size,
          height: piece.size * 0.6,
          borderRadius: 1.5,
          backgroundColor: piece.color,
        },
        style,
      ]}
    />
  );
}

export function Burst({ trigger, colors, size = 0 }: { trigger: number; colors: string[]; size?: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);

  useEffect(() => {
    if (trigger === 0 || reduced) return;
    t.value = 0;
    t.value = withTiming(1, {
      duration: 650,
      easing: Easing.out(Easing.cubic),
    });
  }, [trigger, reduced, t]);

  const pieces: Piece[] = Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1),
    distance: 26 + (i % 3) * 8,
    color: colors[i % colors.length],
    size: 7 + (i % 2) * 2,
    spin: (i % 2 ? 1 : -1) * (180 + i * 20),
  }));

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: size / 2,
        top: size / 2,
        width: 0,
        height: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {pieces.map((p, i) => (
        <Bit key={i} piece={p} t={t} />
      ))}
    </View>
  );
}
