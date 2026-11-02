import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import {
  archivePlan,
  fetchLoyaltyOffer,
  getCurrentMembership,
  hasCurrentMembership,
  listMemberships,
  listPlans,
  recordMembership,
  remindRenewal,
  saveLoyaltyOffer,
  savePlan,
} from '@/features/memberships/api';
import type { Role } from '@/features/auth/types';
import { priceFor } from '@/features/memberships/offers';
import { latestByMember, renewalStart } from '@/features/memberships/rules';
import type {
  LoyaltyOffer,
  MembershipInput,
  MembershipPlan,
  PlanInput,
} from '@/features/memberships/types';

export const membershipKeys = {
  all: ['memberships'] as const,
  plans: (gymId: string) => [...membershipKeys.all, gymId, 'plans'] as const,
  current: (gymId: string, memberId: string) =>
    [...membershipKeys.all, gymId, 'current', memberId] as const,
  covered: (gymId: string, memberId: string) =>
    [...membershipKeys.all, gymId, 'covered', memberId] as const,
  list: (gymId: string) => [...membershipKeys.all, gymId, 'list'] as const,
  loyalty: (gymId: string) => [...membershipKeys.all, gymId, 'loyalty'] as const,
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

export function useLoyaltyOffer(gymId: string) {
  return useQuery({
    queryKey: membershipKeys.loyalty(gymId),
    queryFn: () => fetchLoyaltyOffer(gymId),
  });
}

export function useSaveLoyaltyOffer(gymId: string) {
  const invalidate = useInvalidateMemberships();
  return useMutation({
    mutationFn: (offer: LoyaltyOffer | null) => saveLoyaltyOffer(gymId, offer),
    onSettled: invalidate,
  });
}

/**
 * A member's price for each plan, with the plan's offer or the loyalty offer,
 * for a membership starting when their next one would. Online payments charge
 * the same (member_plan_price() on the server).
 */
export function useMemberPrice(gymId: string, memberId: string) {
  const loyalty = useLoyaltyOffer(gymId).data;
  const memberships = useMemberships(gymId).data;
  return useCallback(
    (plan: MembershipPlan) => {
      const latest = memberships ? latestByMember(memberships).get(memberId) : null;
      return priceFor(plan, {
        loyalty,
        memberships,
        memberId,
        startsOn: renewalStart(latest),
      });
    },
    [loyalty, memberships, memberId],
  );
}
