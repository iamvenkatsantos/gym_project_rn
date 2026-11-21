import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type GymBranding = { name: string; logoUrl: string; tagline?: string | null };

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

/** What to remember for a gym: its logo, name and tagline, or null when it has no logo. */
export function brandingFor(
  gym: { gymName: string; logoUrl?: string | null; tagline?: string | null } | null | undefined,
): GymBranding | null {
  return gym?.logoUrl
    ? { name: gym.gymName, logoUrl: gym.logoUrl, tagline: gym.tagline ?? null }
    : null;
}
