import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GymBranding = { name: string; logoUrl: string };

type BrandingState = {
  /** The last gym the phone opened, if it has a logo. Null shows the plain CoreFit launch screen. */
  branding: GymBranding | null;
  set: (branding: GymBranding | null) => void;
};

/**
 * The launch screen draws before sign-in has loaded, so it can't know the gym yet. The phone keeps
 * the last active gym's logo and name and shows them next time.
 */
export const useGymBranding = create<BrandingState>()(
  persist((set) => ({ branding: null, set: (branding) => set({ branding }) }), {
    name: 'corefit-gym-branding',
    storage: createJSONStorage(() => AsyncStorage),
  }),
);

/** What to remember for a gym: its logo and name, or null when it has no logo. */
export function brandingFor(
  gym: { gymName: string; logoUrl?: string | null } | null | undefined,
): GymBranding | null {
  return gym?.logoUrl ? { name: gym.gymName, logoUrl: gym.logoUrl } : null;
}
