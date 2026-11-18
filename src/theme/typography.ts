import type { TextStyle } from 'react-native';

export const fontFamilies = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  urdu: 'NotoNastaliqUrdu_400Regular',
  urduBold: 'NotoNastaliqUrdu_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'title'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption'
  | 'overline';

type VariantSpec = {
  family: keyof typeof fontFamilies;
  size: number;
  lineHeight: number;
  letterSpacing?: number;
  transform?: TextStyle['textTransform'];
  /** Use the bold Urdu face for this variant. */
  urduBold?: boolean;
};

export const textVariants: Record<TextVariant, VariantSpec> = {
  display: { family: 'display', size: 44, lineHeight: 50, letterSpacing: -1, urduBold: true },
  h1: { family: 'display', size: 30, lineHeight: 36, letterSpacing: -0.5, urduBold: true },
  h2: { family: 'display', size: 23, lineHeight: 29, letterSpacing: -0.2, urduBold: true },
  h3: { family: 'semibold', size: 18, lineHeight: 24, urduBold: true },
  title: { family: 'semibold', size: 16, lineHeight: 22, urduBold: true },
  body: { family: 'regular', size: 15, lineHeight: 22 },
  bodyStrong: { family: 'semibold', size: 15, lineHeight: 22, urduBold: true },
  label: { family: 'semibold', size: 13, lineHeight: 18, urduBold: true },
  caption: { family: 'medium', size: 12, lineHeight: 16 },
  overline: { family: 'bold', size: 11, lineHeight: 14, letterSpacing: 1.2, transform: 'uppercase', urduBold: true },
};

/** Nastaliq script is tall; it needs much more line height than Latin. */
export const URDU_LINE_HEIGHT_FACTOR = 1.75;
export const URDU_SIZE_FACTOR = 0.95;
