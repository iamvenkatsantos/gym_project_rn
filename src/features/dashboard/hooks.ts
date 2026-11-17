import { useQuery } from '@tanstack/react-query';

import { fetchDashboardCounts } from '@/features/dashboard/api';
import { listRenewalsDue } from '@/features/memberships/api';
import { membershipKeys } from '@/features/memberships/hooks';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  counts: (gymId: string) => [...dashboardKeys.all, gymId, 'counts'] as const,
};

/**
 * The Home tiles. Always stale, so coming back to Home (after a payment, a check-in, a trainer
 * match) recounts: it's one small call, and the lists it replaces each had their own key.
 */
export function useDashboardCounts(gymId: string) {
  return useQuery({
    queryKey: dashboardKeys.counts(gymId),
    queryFn: () => fetchDashboardCounts(gymId),
    staleTime: 0,
  });
}

/** The first few renewals due and how many there are, for Home. */
export function useRenewalsDue(gymId: string, limit: number) {
  return useQuery({
    queryKey: [...membershipKeys.all, gymId, 'renewals-due', limit],
    queryFn: () => listRenewalsDue(gymId, limit),
    staleTime: 0,
  });
}
