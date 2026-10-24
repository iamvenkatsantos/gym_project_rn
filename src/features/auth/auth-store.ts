import { create } from 'zustand';

import type { GymRole, Profile } from '@/features/auth/types';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  /** The gym the app is currently showing; the user's role comes from this gym. */
  activeGymId: string | null;
  /** Signed in from an invite or reset link and still has to choose a password. */
  needsPassword: boolean;
  /** Why the last invite, reset or confirmation link didn't sign them in. */
  linkError: string | null;
  setProfile: (profile: Profile | null) => void;
  setActiveGym: (gymId: string) => void;
  setNeedsPassword: (needsPassword: boolean) => void;
  setLinkError: (linkError: string | null) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  activeGymId: null,
  needsPassword: false,
  linkError: null,
  setProfile: (profile) => {
    const current = get().activeGymId;
    const keepCurrent = profile?.gyms.some((g) => g.gymId === current);
    set({
      profile,
      status: profile ? 'signedIn' : 'signedOut',
      activeGymId: keepCurrent ? current : (profile?.gyms[0]?.gymId ?? null),
    });
  },
  setActiveGym: (gymId) => set({ activeGymId: gymId }),
  setNeedsPassword: (needsPassword) => set({ needsPassword }),
  setLinkError: (linkError) => set({ linkError }),
}));

export function selectActiveGym(state: AuthState): GymRole | null {
  return state.profile?.gyms.find((g) => g.gymId === state.activeGymId) ?? null;
}
