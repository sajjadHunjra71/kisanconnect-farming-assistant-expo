import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/theme';
import type { Palette } from '@/theme/colors';
import {
  fontFamilies,
  textVariants,
  URDU_LINE_HEIGHT_FACTOR,
  URDU_SIZE_FACTOR,
  type TextVariant,
} from '@/theme/typography';

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  color?: keyof Palette;
  align?: 'auto' | 'start' | 'center' | 'end';
  /** Keep Latin font even in Urdu (numbers, units, brand). */
  latin?: boolean;
};

export function Text({
  variant = 'body',
  color = 'ink',
  align = 'auto',
  latin = false,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();
  const { isRTL, textAlign } = useDirection();
  const spec = textVariants[variant];
  const urdu = isRTL && !latin;

  const resolvedAlign: TextStyle['textAlign'] =
    align === 'center' ? 'center' : align === 'end' ? (isRTL ? 'left' : 'right') : textAlign;

  const base: TextStyle = urdu
    ? {
        fontFamily: spec.urduBold ? fontFamilies.urduBold : fontFamilies.urdu,
        fontSize: Math.round(spec.size * URDU_SIZE_FACTOR),
        lineHeight: Math.round(spec.size * URDU_SIZE_FACTOR * URDU_LINE_HEIGHT_FACTOR),
        writingDirection: 'rtl',
      }
    : {
        fontFamily: fontFamilies[spec.family],
        fontSize: spec.size,
        lineHeight: spec.lineHeight,
        letterSpacing: spec.letterSpacing,
        textTransform: spec.transform,
      };

  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.4}
      style={[base, { color: colors[color], textAlign: resolvedAlign }, style]}
    />
  );
}
