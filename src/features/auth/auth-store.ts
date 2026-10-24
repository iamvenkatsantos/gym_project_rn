import { create } from 'zustand';

import type { Profile } from '@/features/auth/types';

type AuthState = {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  profile: null,
  setProfile: (profile) => set({ profile, status: profile ? 'signedIn' : 'signedOut' }),
}));
