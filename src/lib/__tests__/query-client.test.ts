import { queryClient, STATIC_STALE_TIME } from '@/lib/query-client';

describe('query client', () => {
  it('keeps rarely changing data fresh longer than the default', () => {
    const defaultStale = queryClient.getDefaultOptions().queries?.staleTime as number;
    expect(defaultStale).toBe(30_000);
    expect(STATIC_STALE_TIME).toBe(5 * 60_000);
    expect(STATIC_STALE_TIME).toBeGreaterThan(defaultStale);
  });
});
