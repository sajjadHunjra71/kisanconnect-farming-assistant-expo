import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/store/settings-store';
import { darkPalette, lightPalette, type Palette } from './colors';
import { elevation, radius, spacing } from './tokens';

export type Theme = {
  scheme: 'light' | 'dark';
  colors: Palette;
  spacing: typeof spacing;
  radius: typeof radius;
  elevation: typeof elevation;
};

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => s.themeMode);
  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<Theme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkPalette : lightPalette,
      spacing,
      radius,
      elevation,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
