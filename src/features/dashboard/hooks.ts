import { useQuery } from '@tanstack/react-query';

import { getOwnerDashboard, listRenewalsDue } from '@/features/dashboard/api';
import { membershipKeys } from '@/features/memberships/hooks';
import { toIsoDate } from '@/features/memberships/rules';

/**
 * The owner's Home numbers. It sits under the memberships key so recording or changing a
 * membership refreshes it, and it is never stale: it is a few bytes, and a trainer link, a
 * birthday or a new member can change it without touching that key, so Home asks again each visit.
 */
export function useOwnerDashboard(gymId: string) {
  const day = toIsoDate(new Date());
  return useQuery({
    queryKey: [...membershipKeys.all, gymId, 'dashboard', day],
    queryFn: () => getOwnerDashboard(gymId),
    staleTime: 0,
  });
}

/** The Renewals screen's list. Under the memberships key, so recording a membership refreshes it. */
export function useRenewalsDue(gymId: string) {
  const day = toIsoDate(new Date());
  return useQuery({
    queryKey: [...membershipKeys.all, gymId, 'renewals-due', day],
    queryFn: () => listRenewalsDue(gymId),
  });
}
