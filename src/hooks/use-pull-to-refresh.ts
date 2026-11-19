import { useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useIsFocused } from 'expo-router';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { screenQueries } from '@/lib/query-client';

/**
 * One refresh for every screen: pulling down refetches every query on screen (and the
 * person's role, in case an owner changed it), so nothing needs an app restart.
 */
export function usePullToRefresh(screenId?: string) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([queryClient.refetchQueries({
          type: 'active',
          predicate: (query) => !screenId || screenQueries.isFor(screenId, query),
        }),
        refreshProfile(),]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, screenId]);

  return { refreshing, onRefresh };
}

/** Coming back to a screen (back button, tab switch) refetches whatever has gone stale. */
export function useRefreshOnFocus(enabled = true, screenId?: string) {
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
      queryClient
        .refetchQueries({
          type: 'active',
          stale: true,
          predicate: (query) => !screenId || screenQueries.isFor(screenId, query),
        })
        .catch(() => {});
    }, [enabled, queryClient, screenId]),
  );
}

/**
 * Marks this screen as the one whose queries are being started, while it is focused, so a tab
 * switch or a pull refetches only its own data (see `screen-queries.ts`). Returns the screen's id.
 */
export function useScreenQueries() {
  const id = useId();
  const focused = useIsFocused();
  // During render, so it is set before the screen's own queries subscribe.
  if (focused) screenQueries.setFocused(id);
  useEffect(() => () => screenQueries.forget(id), [id]);
  return id;
}

async function refreshProfile() {
  const { status, setProfile } = useAuthStore.getState();
  if (status !== 'signedIn') return;
  const profile = await restoreProfile().catch(() => null);
  if (profile) setProfile(profile);
}
