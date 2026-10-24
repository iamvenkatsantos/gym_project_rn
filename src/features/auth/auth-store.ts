import { create } from 'zustand';

import type { GymRole, Profile } from '@/features/auth/types';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  /** The gym the app is currently showing; the user's role comes from this gym. */
  activeGymId: string | null;
  setProfile: (profile: Profile | null) => void;
  setActiveGym: (gymId: string) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  activeGymId: null,
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
}));

export function selectActiveGym(state: AuthState): GymRole | null {
  return state.profile?.gyms.find((g) => g.gymId === state.activeGymId) ?? null;
}
