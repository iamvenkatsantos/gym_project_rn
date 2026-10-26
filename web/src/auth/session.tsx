import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchOwnedGyms } from '../data/api';
import type { OwnedGym } from '../data/types';
import { supabase } from '../lib/supabase';

const GYM_KEY = 'corefit.dashboard.gym';

function readSavedGym() {
  try {
    return localStorage.getItem(GYM_KEY);
  } catch {
    return null;
  }
}

/** undefined while the saved session loads, null when signed out. */
export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export function useOwnedGyms(userId: string) {
  return useQuery({ queryKey: ['owned-gyms', userId], queryFn: () => fetchOwnedGyms(userId) });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await supabase.auth.signOut();
    queryClient.clear();
  };
}

type GymContextValue = {
  gym: OwnedGym;
  gyms: OwnedGym[];
  email: string;
  selectGym: (gymId: string) => void;
};

const GymContext = createContext<GymContextValue | null>(null);

/** The owner's open gym. Owners of several gyms switch between them in the sidebar. */
export function GymProvider({
  gyms,
  email,
  children,
}: {
  gyms: OwnedGym[];
  email: string;
  children: ReactNode;
}) {
  const [gymId, setGymId] = useState(readSavedGym);
  const gym = gyms.find((g) => g.gymId === gymId) ?? gyms[0];
  const selectGym = (next: string) => {
    setGymId(next);
    try {
      localStorage.setItem(GYM_KEY, next);
    } catch {
      // Private windows can refuse storage; the choice then lasts until reload.
    }
  };
  return (
    <GymContext.Provider value={{ gym, gyms, email, selectGym }}>{children}</GymContext.Provider>
  );
}

export function useGym() {
  const value = useContext(GymContext);
  if (!value) throw new Error('useGym needs a GymProvider');
  return value;
}
