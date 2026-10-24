import { useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchProfile, restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import type { Profile } from '@/features/auth/types';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

/** Restores any saved session on launch and keeps the store in sync with Supabase auth. */
export function useAuthBootstrap() {
  const setProfile = useAuthStore((s) => s.setProfile);

  useEffect(() => {
    // An invite or reset link may sign someone in first; then that session wins.
    const restore = (profile: Profile | null) => {
      if (useAuthStore.getState().status === 'loading') setProfile(profile);
    };
    restoreProfile()
      .then(restore)
      .catch(() => restore(null));

    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        useAuthStore.getState().setNeedsPassword(false);
        setProfile(null);
      } else if (!session) {
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
