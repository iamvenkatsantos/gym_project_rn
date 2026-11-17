import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DefaultThemeColor, isThemeColor, type ThemeColorId } from '@/constants/theme';

export type AppearanceChoice = 'system' | 'light' | 'dark';

type AppearanceState = {
  choice: AppearanceChoice;
  setChoice: (choice: AppearanceChoice) => void;
  /** Theme colour for buttons, chips, tabs and green text; light/dark stays with `choice`. */
  color: ThemeColorId;
  setColor: (color: ThemeColorId) => void;
};

/** Native pieces (alerts, keyboards, date pickers) follow the same choice as the app. */
function applyToNative(choice: AppearanceChoice) {
  try {
    Appearance.setColorScheme(choice === 'system' ? 'auto' : choice);
  } catch {
    // Not supported on this platform (e.g. web); the app's own colours still follow the choice.
  }
}

/**
 * Light, dark or follow the phone, plus the theme colour. Kept on the device, so it's per phone,
 * not per account.
 */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      choice: 'system',
      setChoice: (choice) => {
        applyToNative(choice);
        set({ choice });
      },
      color: DefaultThemeColor,
      setColor: (color) => set({ color: isThemeColor(color) ? color : DefaultThemeColor }),
    }),
    {
      name: 'corefit-appearance',
      storage: createJSONStorage(() => AsyncStorage),
      // Phones saved before theme colours existed have no `color`; a removed colour falls back too.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppearanceState>;
        return {
          ...current,
          ...saved,
          color: isThemeColor(saved.color) ? saved.color : DefaultThemeColor,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.choice !== 'system') applyToNative(state.choice);
      },
    },
  ),
);
