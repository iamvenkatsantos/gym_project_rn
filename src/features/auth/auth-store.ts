import { create } from 'zustand';

import type { GymRole, Profile } from '@/features/auth/types';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  /** The gym the app is currently showing; the user's role comes from this gym. */
  activeGymId: string | null;
  /**
   * Platform admins see the admin area by default. They can switch to a gym they belong to
   * from Account, and back.
   */
  adminMode: boolean;
  /** Signed in from an invite or reset link and still has to choose a password. */
  needsPassword: boolean;
  /** Why the last invite, reset or confirmation link didn't sign them in. */
  linkError: string | null;
  setProfile: (profile: Profile | null) => void;
  setActiveGym: (gymId: string) => void;
  setAdminMode: (adminMode: boolean) => void;
  setNeedsPassword: (needsPassword: boolean) => void;
  setLinkError: (linkError: string | null) => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  profile: null,
  activeGymId: null,
  adminMode: true,
  needsPassword: false,
  linkError: null,
  setProfile: (profile) => {
    const current = get().activeGymId;
    const keepCurrent = profile?.gyms.some((g) => g.gymId === current);
    set({
      profile,
      status: profile ? 'signedIn' : 'signedOut',
      activeGymId: keepCurrent ? current : (profile?.gyms[0]?.gymId ?? null),
      // The next admin to sign in starts in the admin area.
      adminMode: profile ? get().adminMode : true,
    });
  },
  setActiveGym: (gymId) => set({ activeGymId: gymId, adminMode: false }),
  setAdminMode: (adminMode) => set({ adminMode }),
  setNeedsPassword: (needsPassword) => set({ needsPassword }),
  setLinkError: (linkError) => set({ linkError }),
}));

/** Whether the app is showing the admin area rather than a gym. */
export function selectInAdmin(state: AuthState): boolean {
  return !!state.profile?.isPlatformAdmin && state.adminMode;
}

/** The gym the app is showing, or null in the admin area. */
export function selectActiveGym(state: AuthState): GymRole | null {
  if (selectInAdmin(state)) return null;
  return state.profile?.gyms.find((g) => g.gymId === state.activeGymId) ?? null;
}
