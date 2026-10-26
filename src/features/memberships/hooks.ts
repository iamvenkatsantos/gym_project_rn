import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  archivePlan,
  getCurrentMembership,
  listMemberships,
  listPlans,
  recordMembership,
  remindRenewal,
  savePlan,
} from '@/features/memberships/api';
import type { MembershipInput, PlanInput } from '@/features/memberships/types';

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
