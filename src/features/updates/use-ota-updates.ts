import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { shouldCheckForUpdate } from './rules';

/**
 * The app already checks for an update on every launch. This also checks when it comes back to
 * the front (at most hourly) and downloads it quietly. It applies on the next launch, never
 * mid-workout.
 */
export function useOtaUpdates() {
  const lastCheckedAt = useRef<number | null>(null);

  useEffect(() => {
    if (__DEV__ || !Updates.isEnabled) return;
    // The launch check just ran.
    lastCheckedAt.current = Date.now();
    const sub = AppState.addEventListener('change', (state) => {
      const now = Date.now();
      if (state !== 'active' || !shouldCheckForUpdate(lastCheckedAt.current, now)) return;
      lastCheckedAt.current = now;
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch(() => {
          // No signal or server down: try again next time.
        });
    });
    return () => sub.remove();
  }, []);
}
