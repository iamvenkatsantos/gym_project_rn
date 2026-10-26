import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import { canSetUpGym, createGym, fetchGymDetails, updateGymDetails } from '@/features/gyms/api';
import { cleanGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';

export const gymKeys = {
  all: ['gyms'] as const,
  canSetUp: () => [...gymKeys.all, 'can-set-up'] as const,
  details: (gymId: string) => [...gymKeys.all, gymId, 'details'] as const,
};

export function useCanSetUpGym() {
  return useQuery({ queryKey: gymKeys.canSetUp(), queryFn: canSetUpGym });
}

export function useGymDetails(gymId: string) {
  return useQuery({ queryKey: gymKeys.details(gymId), queryFn: () => fetchGymDetails(gymId) });
}

/**
 * Creates the gym, then switches the app to it, so the new owner lands on an
 * empty dashboard of their own gym.
 */
export function useCreateGym() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (details: GymDetails) => {
      const cleaned = cleanGymDetails(details);
      const gymId = await createGym(cleaned);
      const { profile, setProfile, setActiveGym } = useAuthStore.getState();
      // Demo mode has no session to reload, so add the gym to the profile in memory.
      const next =
        (await restoreProfile()) ??
        (profile && {
          ...profile,
          gyms: [...profile.gyms, { gymId, gymName: cleaned.name, role: 'owner' as const }],
        });
      setProfile(next);
      setActiveGym(gymId);
      return gymId;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gymKeys.all }),
  });
}

export function useUpdateGymDetails(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (details: GymDetails) => {
      const cleaned = cleanGymDetails(details);
      await updateGymDetails(gymId, cleaned);
      // The gym's name shows across the app, so keep the profile's copy in step.
      const { profile, setProfile } = useAuthStore.getState();
      if (profile) {
        setProfile({
          ...profile,
          gyms: profile.gyms.map((g) => (g.gymId === gymId ? { ...g, gymName: cleaned.name } : g)),
        });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gymKeys.details(gymId) }),
  });
}
