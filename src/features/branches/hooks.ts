import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  addBranch,
  fetchAdminBranches,
  fetchBillingSettings,
  fetchBrandOverview,
  renameBrand,
  setBranchFee,
  setGymFee,
  setOnlineFeesOnMember,
  setOnlinePayments,
} from '@/features/branches/api';
import { cleanGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';

export const branchKeys = {
  all: ['branches'] as const,
  admin: () => [...branchKeys.all, 'admin'] as const,
  billing: () => [...branchKeys.all, 'billing'] as const,
  overview: (brandId: string) => [...branchKeys.all, 'overview', brandId] as const,
};

/**
 * After a fee or add-on change, the branch lists and each branch's CoreFit Gym plan both
 * show new amounts. ['subscription'] is subscriptionKeys.all, written out to avoid an
 * import cycle with the subscription hooks.
 */
function refreshBilling(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: branchKeys.all });
  queryClient.invalidateQueries({ queryKey: ['subscription'] });
}

export function useAdminBranches() {
  return useQuery({ queryKey: branchKeys.admin(), queryFn: fetchAdminBranches });
}

export function useBrandOverview(brandId: string | undefined) {
  return useQuery({
    queryKey: branchKeys.overview(brandId ?? ''),
    queryFn: () => fetchBrandOverview(brandId!),
    enabled: !!brandId,
  });
}

export function useAddBranch(brandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ details, feeCents }: { details: GymDetails; feeCents: number | null }) => {
      const gymId = await addBranch(brandId, cleanGymDetails(details), feeCents);
      // An admin who also owns the brand gets the branch too, so pick it up.
      const profile = await restoreProfile();
      if (profile) useAuthStore.getState().setProfile(profile);
      return gymId;
    },
    onSettled: () => refreshBilling(queryClient),
  });
}

export function useRenameBrand(brandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameBrand(brandId, name.trim()),
    onSettled: () => refreshBilling(queryClient),
  });
}

export function useBillingSettings() {
  return useQuery({ queryKey: branchKeys.billing(), queryFn: fetchBillingSettings });
}

export function useSetBranchFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setBranchFee,
    onSettled: () => refreshBilling(queryClient),
  });
}

export function useSetGymFee(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feeCents: number | null) => setGymFee(gymId, feeCents),
    onSettled: () => refreshBilling(queryClient),
  });
}

export function useSetOnlinePayments(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ enabled, accountId }: { enabled: boolean; accountId: string }) =>
      setOnlinePayments(gymId, enabled, accountId),
    onSettled: () => refreshBilling(queryClient),
  });
}

export function useSetOnlineFeesOnMember(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (onMember: boolean) => setOnlineFeesOnMember(gymId, onMember),
    onSettled: () => refreshBilling(queryClient),
  });
}
