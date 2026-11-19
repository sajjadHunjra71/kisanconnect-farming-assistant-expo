import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LanguageCode } from '@/i18n/languages';

export type ThemeMode = 'system' | 'light' | 'dark';
export type Units = 'acre' | 'kanal' | 'hectare';

type SettingsState = {
  language: LanguageCode;
  themeMode: ThemeMode;
  units: Units;
  hasOnboarded: boolean;
  /** Farm shown on the Farm tab when there are several. */
  selectedFarmId: string | null;
  setSelectedFarmId: (id: string | null) => void;
  notifications: { weather: boolean; reminders: boolean; mandi: boolean; expert: boolean };
  hydrated: boolean;
  setLanguage: (language: LanguageCode) => void;
  setThemeMode: (mode: ThemeMode) => void;
  setUnits: (units: Units) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  toggleNotification: (key: keyof SettingsState['notifications']) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'en',
      themeMode: 'system',
      units: 'acre',
      hasOnboarded: false,
      selectedFarmId: null,
      setSelectedFarmId: (selectedFarmId) => set({ selectedFarmId }),
      notifications: { weather: true, reminders: true, mandi: false, expert: true },
      hydrated: false,
      setLanguage: (language) => set({ language }),
      setThemeMode: (themeMode) => set({ themeMode }),
      setUnits: (units) => set({ units }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      resetOnboarding: () => set({ hasOnboarded: false }),
      toggleNotification: (key) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: !s.notifications[key] } })),
    }),
    {
      name: 'kisanconnect-settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated: _h, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useSettingsStore.setState({ hydrated: true });
      },
    },
  ),
);
