import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useDirection } from '@/hooks/use-direction';

type Props = { data: number[]; width: number; height: number; color: string; fill?: boolean };

/** Tiny dependency-free trend line (react-native-svg). Mirrored in RTL so time flows with reading direction. */
export function Sparkline({ data, width, height, color, fill = true }: Props) {
  const { isRTL } = useDirection();
  if (data.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 4 - ((v - min) / span) * (height - 8)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const id = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <View style={{ width, height, transform: isRTL ? [{ scaleX: -1 }] : [] }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.28} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {fill ? <Path d={area} fill={`url(#${id})`} /> : null}
        <Path d={line} stroke={color} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
