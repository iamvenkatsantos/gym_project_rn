import { useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchProfile, restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

/** Restores any saved session on launch and keeps the store in sync with Supabase auth. */
export function useAuthBootstrap() {
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    restoreProfile()
      .then(setProfile)
      .catch(() => setProfile(null));

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        queryClient.clear();
        setProfile(null);
      } else if (event === 'SIGNED_IN') {
        fetchProfile(session.user.id)
          .then(setProfile)
          .catch(() => setProfile(null));
      }
    });
    // Owners can change someone's role or suspend them at any time, so pick that up on return.
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || useAuthStore.getState().status !== 'signedIn') return;
      restoreProfile()
        .then((profile) => profile && setProfile(profile))
        .catch(() => {});
    });
    return () => {
      data.subscription.unsubscribe();
      appState.remove();
    };
  }, [setProfile]);
}
