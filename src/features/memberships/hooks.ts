import { useQuery } from '@tanstack/react-query';

import { getCurrentMembership, listMemberships, listPlans } from '@/features/memberships/api';

export const membershipKeys = {
  all: ['memberships'] as const,
  plans: (gymId: string) => [...membershipKeys.all, gymId, 'plans'] as const,
  current: (gymId: string, memberId: string) =>
    [...membershipKeys.all, gymId, 'current', memberId] as const,
  list: (gymId: string) => [...membershipKeys.all, gymId, 'list'] as const,
};

export function usePlans(gymId: string) {
  return useQuery({ queryKey: membershipKeys.plans(gymId), queryFn: () => listPlans(gymId) });
}

export function useCurrentMembership(gymId: string, memberId: string) {
  return useQuery({
    queryKey: membershipKeys.current(gymId, memberId),
    queryFn: () => getCurrentMembership(gymId, memberId),
  });
}

export function useMemberships(gymId: string) {
  return useQuery({
    queryKey: membershipKeys.list(gymId),
    queryFn: () => listMemberships(gymId),
  });
}
