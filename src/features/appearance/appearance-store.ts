import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type AppearanceChoice = 'system' | 'light' | 'dark';

type AppearanceState = {
  choice: AppearanceChoice;
  setChoice: (choice: AppearanceChoice) => void;
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
 * Light, dark or follow the phone. Kept on the device, so it's per phone, not per account. The
 * theme colour is the gym owner's choice (`gyms.theme_color`), not stored here.
 */
export const useAppearance = create<AppearanceState>()(
  persist(
    (set) => ({
      choice: 'system',
      setChoice: (choice) => {
        applyToNative(choice);
        set({ choice });
      },
    }),
    {
      name: 'corefit-appearance',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.choice !== 'system') applyToNative(state.choice);
      },
    },
  ),
);
