import type { Query, QueryCache } from '@tanstack/react-query';

/**
 * Which screen each query belongs to, so coming back to a screen (or pulling down on it)
 * refetches that screen's data and not the data of every other tab that is still mounted.
 * Tabs stay mounted, so React Query counts all of their queries as active; without this, opening
 * Payments also reloaded People, memberships, attendance and redrew those tabs.
 *
 * A query belongs to a screen when one of its observers is added while that screen is the focused
 * one. A query no screen owns (the tab bar's, the app's) is refreshed by every screen, as before.
 */
export function createScreenQueries(cache: QueryCache) {
  const owned = new Map<string, Set<string>>();
  const everOwned = new Set<string>();
  let current: string | null = null;

  cache.subscribe((event) => {
    if (event.type !== 'observerAdded' || current === null) return;
    const hash = event.query.queryHash;
    owned.get(current)?.add(hash);
    everOwned.add(hash);
  });

  return {
    /** Call while the screen is focused: queries that start being watched now are its own. */
    setFocused(screenId: string) {
      current = screenId;
      if (!owned.has(screenId)) owned.set(screenId, new Set());
    },
    forget(screenId: string) {
      owned.delete(screenId);
      if (current === screenId) current = null;
    },
    /** True for this screen's queries and for ones no screen owns; false for another screen's. */
    isFor(screenId: string, query: Pick<Query, 'queryHash'>) {
      return owned.get(screenId)?.has(query.queryHash) || !everOwned.has(query.queryHash);
    },
  };
}
