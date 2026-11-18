/**
 * KisanConnect palette — "field almanac".
 * Paper-cream surfaces, forest-green ink, wheat-gold accent,
 * terracotta for risk and sky-blue for weather.
 */
export type Palette = {
  background: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  border: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  primary: string;
  primaryPressed: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  onAccent: string;
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  success: string;
  successSoft: string;
  heroFrom: string;
  heroTo: string;
  onHero: string;
  onHeroMuted: string;
  overlay: string;
  shadow: string;
};

export const lightPalette: Palette = {
  background: '#F6F2E9',
  surface: '#FFFDF8',
  surfaceAlt: '#EFE8D8',
  surfaceRaised: '#FFFFFF',
  border: '#E3DAC6',
  ink: '#1B2A21',
  inkMuted: '#58665B',
  inkSubtle: '#8A9488',
  primary: '#1F5C3F',
  primaryPressed: '#174A32',
  onPrimary: '#FFFFFF',
  primarySoft: '#DCEBDF',
  accent: '#D9A13B',
  onAccent: '#2A1E06',
  accentSoft: '#F6E7C4',
  danger: '#B5532E',
  dangerSoft: '#F5DED3',
  warning: '#C07A12',
  warningSoft: '#FBEBCC',
  info: '#2F6F9F',
  infoSoft: '#DDEAF4',
  success: '#2F7D4E',
  successSoft: '#D8EEDF',
  heroFrom: '#1F5C3F',
  heroTo: '#2F7A55',
  onHero: '#FFFFFF',
  onHeroMuted: 'rgba(255,255,255,0.74)',
  overlay: 'rgba(16,24,19,0.55)',
  shadow: '#2B3A2F',
};

export const darkPalette: Palette = {
  background: '#0E1511',
  surface: '#151F19',
  surfaceAlt: '#1C2922',
  surfaceRaised: '#1F2D25',
  border: '#2A3A31',
  ink: '#EEF1E8',
  inkMuted: '#A3B2A6',
  inkSubtle: '#6F7F73',
  primary: '#7BC59A',
  primaryPressed: '#68B387',
  onPrimary: '#0B1A11',
  primarySoft: '#1E3A2B',
  accent: '#E9B957',
  onAccent: '#2A1E06',
  accentSoft: '#3A2F1A',
  danger: '#E58763',
  dangerSoft: '#3A231A',
  warning: '#F0B04A',
  warningSoft: '#3A2C14',
  info: '#86BBE2',
  infoSoft: '#1A2C3A',
  success: '#7BC59A',
  successSoft: '#1E3A2B',
  heroFrom: '#173B2A',
  heroTo: '#22553C',
  onHero: '#F3F6EE',
  onHeroMuted: 'rgba(243,246,238,0.7)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};
