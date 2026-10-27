import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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
} from '@/features/branches/api';
import { cleanGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';

export const branchKeys = {
  all: ['branches'] as const,
  admin: () => [...branchKeys.all, 'admin'] as const,
  billing: () => [...branchKeys.all, 'billing'] as const,
  overview: (brandId: string) => [...branchKeys.all, 'overview', brandId] as const,
};

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
    onSettled: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useRenameBrand(brandId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => renameBrand(brandId, name.trim()),
    onSettled: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useBillingSettings() {
  return useQuery({ queryKey: branchKeys.billing(), queryFn: fetchBillingSettings });
}

export function useSetBranchFee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: setBranchFee,
    onSettled: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}

export function useSetGymFee(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (feeCents: number | null) => setGymFee(gymId, feeCents),
    onSettled: () => queryClient.invalidateQueries({ queryKey: branchKeys.all }),
  });
}
