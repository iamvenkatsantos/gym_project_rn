import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archivePlan,
  getCurrentMembership,
  hasCurrentMembership,
  listMemberships,
  listPlans,
  recordMembership,
  remindRenewal,
  savePlan,
} from '@/features/memberships/api';
import type { Role } from '@/features/auth/types';
import type { MembershipInput, PlanInput } from '@/features/memberships/types';

export const membershipKeys = {
  all: ['memberships'] as const,
  plans: (gymId: string) => [...membershipKeys.all, gymId, 'plans'] as const,
  current: (gymId: string, memberId: string) =>
    [...membershipKeys.all, gymId, 'current', memberId] as const,
  covered: (gymId: string, memberId: string) =>
    [...membershipKeys.all, gymId, 'covered', memberId] as const,
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

/**
 * Whether a member can check in, train and book today. Always true for staff, who need no
 * membership; undefined while loading.
 */
export function useHasMembership(gymId: string, userId: string, role: Role) {
  const query = useQuery({
    queryKey: membershipKeys.covered(gymId, userId),
    queryFn: () => hasCurrentMembership(gymId, userId),
    enabled: role === 'member',
  });
  return role === 'member' ? query.data : true;
}

export function useMemberships(gymId: string) {
  return useQuery({
    queryKey: membershipKeys.list(gymId),
    queryFn: () => listMemberships(gymId),
  });
}

function useInvalidateMemberships() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: membershipKeys.all });
}

export function useSavePlan(gymId: string) {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: ({ planId, input }: { planId: string | null; input: PlanInput }) =>
      savePlan(gymId, planId, input),
    onSettled: invalidate,
  });
}

export function useArchivePlan() {
  const invalidate = useInvalidateMemberships();
  return useMutation({ mutationFn: archivePlan, onSettled: invalidate });
}

export function useRecordMembership(gymId: string) {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: (input: MembershipInput) => recordMembership(gymId, input),
    onSettled: invalidate,
  });
}

export function useRemindRenewal(gymId: string) {
  return useMutation({ mutationFn: (memberId: string) => remindRenewal(gymId, memberId) });
}
