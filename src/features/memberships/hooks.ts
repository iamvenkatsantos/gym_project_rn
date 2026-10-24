import { useQuery } from '@tanstack/react-query';

import { getCurrentMembership, listMemberships, listPlans } from '@/features/memberships/api';

export const membershipKeys = {
  all: ['memberships'] as const,
  plans: () => [...membershipKeys.all, 'plans'] as const,
  current: (memberId: string) => [...membershipKeys.all, 'current', memberId] as const,
  list: () => [...membershipKeys.all, 'list'] as const,
};

export function usePlans() {
  return useQuery({ queryKey: membershipKeys.plans(), queryFn: listPlans });
}

export function useCurrentMembership(memberId: string) {
  return useQuery({
    queryKey: membershipKeys.current(memberId),
    queryFn: () => getCurrentMembership(memberId),
  });
}

export function useMemberships() {
  return useQuery({ queryKey: membershipKeys.list(), queryFn: listMemberships });
}
