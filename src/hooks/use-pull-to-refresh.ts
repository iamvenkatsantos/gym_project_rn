import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * One refresh for every screen: pulling down refetches every query on screen (and the
 * person's role, in case an owner changed it), so nothing needs an app restart.
 */
export function usePullToRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([queryClient.refetchQueries({ type: 'active' }), refreshProfile()]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}

/** Coming back to a screen (back button, tab switch) refetches whatever has gone stale. */
export function useRefreshOnFocus(enabled = true) {
  const queryClient = useQueryClient();
  const firstFocus = useRef(true);

  useFocusEffect(
    useCallback(() => {
      // The first focus is the mount, which already fetched.
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (!enabled) return;
      queryClient.refetchQueries({ type: 'active', stale: true }).catch(() => {});
    }, [enabled, queryClient]),
  );
}

async function refreshProfile() {
  const { status, setProfile } = useAuthStore.getState();
  if (status !== 'signedIn') return;
  const profile = await restoreProfile().catch(() => null);
  if (profile) setProfile(profile);
}
