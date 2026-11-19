import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { createScreenQueries } from '@/lib/screen-queries';

/**
 * For data that changes rarely and only when someone on this phone or an owner edits it (plans, rules,
 * gym details, trainer list). Saving invalidates it, and pulling down always refetches, so it only
 * saves the 30-second refetch on every tab switch and return to the app.
 */
export const STATIC_STALE_TIME = 5 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/** Which screen's queries are whose; see screen-queries.ts. */
export const screenQueries = createScreenQueries(queryClient.getQueryCache());

// React Native has no window focus event, so tell React Query when the app comes back to the
// foreground; it then refetches stale queries on screen, like payments recorded from another phone.
if (Platform.OS !== 'web') {
  focusManager.setEventListener((setFocused) => {
    const subscription = AppState.addEventListener('change', (state) =>
      setFocused(state === 'active'),
    );
    return () => subscription.remove();
  });
}
