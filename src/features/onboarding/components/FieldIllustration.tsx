import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme';

/** Hand-built SVG scene: sun over striped fields with a wheat stalk. No image assets needed. */
export function FieldIllustration({ height = 300 }: { height?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 360 300" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.heroFrom} />
            <Stop offset="1" stopColor={colors.heroTo} />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="300" fill="url(#sky)" />
        <Circle cx="268" cy="92" r="44" fill={colors.accent} opacity={0.95} />
        <Circle cx="268" cy="92" r="70" fill={colors.accent} opacity={0.12} />
        <Path d="M0 190 C 80 160, 160 175, 360 150 L360 300 L0 300 Z" fill="#2F7A55" opacity={0.85} />
        <Path d="M0 220 C 100 195, 220 210, 360 190 L360 300 L0 300 Z" fill="#3E8E5A" />
        <Path d="M0 250 C 120 232, 240 244, 360 228 L360 300 L0 300 Z" fill="#D9A13B" opacity={0.9} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <Path key={i} d={`M${20 + i * 46} 300 L${70 + i * 40} 238`} stroke="#B9842A" strokeWidth={3} opacity={0.5} />
        ))}
        <Path d="M78 300 C 80 250, 84 210, 92 170" stroke="#F6E7C4" strokeWidth={3} fill="none" />
        {[0, 1, 2, 3, 4].map((i) => (
          <Path key={`g${i}`} d={`M${90 - i * 1.5} ${176 + i * 14} q -14 -6 -16 -18 q 12 2 16 18 M${92 - i * 1.5} ${176 + i * 14} q 14 -6 16 -18 q -12 2 -16 18`} fill="#F6E7C4" />
        ))}
      </Svg>
    </View>
  );
}
