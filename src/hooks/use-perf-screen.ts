import { useFocusEffect, usePathname } from 'expo-router';
import { useCallback } from 'react';

import { perfEnabled, perfRecord, requestsSince } from '@/lib/perf-log';
import { queryClient } from '@/lib/query-client';

/**
 * Dev timing (EXPO_PUBLIC_PERF_LOG): how long a screen takes from coming into focus until its queries
 * settle. It runs only for the focused screen, so a tab that is open behind another logs nothing.
 */
export function usePerfScreen() {
  const pathname = usePathname();

  useFocusEffect(
    useCallback(() => {
      if (!perfEnabled) return;
      const started = Date.now();
      let done = false;
      const check = () => {
        if (done || queryClient.isFetching() > 0) return;
        done = true;
        unsubscribe();
        perfRecord({
          kind: 'screen',
          name: pathname.replace(/[0-9a-f-]{8,}/gi, ':id'),
          ms: Date.now() - started,
          requests: requestsSince(started),
        });
      };
      const unsubscribe = queryClient.getQueryCache().subscribe(check);
      // A screen with nothing to fetch settles at once.
      const timer = setTimeout(check, 0);
      return () => {
        done = true;
        clearTimeout(timer);
        unsubscribe();
      };
    }, [pathname]),
  );
}
