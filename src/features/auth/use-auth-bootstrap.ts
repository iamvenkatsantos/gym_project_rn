import { useEffect } from 'react';

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
    return () => data.subscription.unsubscribe();
  }, [setProfile]);
}
