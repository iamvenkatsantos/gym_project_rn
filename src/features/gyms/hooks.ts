import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ThemeColorId } from '@/constants/theme';
import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  canSetUpGym,
  createGym,
  fetchGymDetails,
  saveGymLogo,
  setGymThemeColor,
  updateGymDetails,
} from '@/features/gyms/api';
import { gymLogoUrl } from '@/features/gyms/logo';
import type { PickedPhoto } from '@/features/onboarding/types';
import { cleanGymDetails } from '@/features/gyms/rules';
import type { GymDetails } from '@/features/gyms/types';
import { STATIC_STALE_TIME } from '@/lib/query-client';

export const gymKeys = {
  all: ['gyms'] as const,
  canSetUp: () => [...gymKeys.all, 'can-set-up'] as const,
  details: (gymId: string) => [...gymKeys.all, gymId, 'details'] as const,
};

/** CoreFit's own admins, from the signed-in profile. */
export function useIsPlatformAdmin() {
  return useAuthStore((s) => s.profile?.isPlatformAdmin === true);
}

/** The admin runs CoreFit, not a gym, so they never set one up for themself. */
export function useCanSetUpGym() {
  const isAdmin = useIsPlatformAdmin();
  return useQuery({ queryKey: gymKeys.canSetUp(), queryFn: canSetUpGym, enabled: !isAdmin });
}

export function useGymDetails(gymId: string) {
  return useQuery({
    queryKey: gymKeys.details(gymId),
    queryFn: () => fetchGymDetails(gymId),
    staleTime: STATIC_STALE_TIME,
  });
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

/** Saves the gym's theme colour and shows it at once; undone if the server refuses. */
export function useSetGymThemeColor(gymId: string) {
  return useMutation({
    mutationFn: (color: ThemeColorId) => setGymThemeColor(gymId, color),
    onMutate: (color) => {
      const { profile, setProfile } = useAuthStore.getState();
      const previous = profile?.gyms.find((g) => g.gymId === gymId)?.themeColor;
      if (profile) {
        setProfile({
          ...profile,
          gyms: profile.gyms.map((g) => (g.gymId === gymId ? { ...g, themeColor: color } : g)),
        });
      }
      return { previous };
    },
    onError: (_error, _color, context) => {
      const { profile, setProfile } = useAuthStore.getState();
      if (profile) {
        setProfile({
          ...profile,
          gyms: profile.gyms.map((g) =>
            g.gymId === gymId ? { ...g, themeColor: context?.previous } : g,
          ),
        });
      }
    },
  });
}

/** Saves (or removes, with null) the gym's logo and shows it at once in the app's copy of the gym. */
export function useSaveGymLogo(gymId: string) {
  return useMutation({
    mutationFn: ({
      photo,
      oldPath,
    }: {
      photo: PickedPhoto | null;
      oldPath: string | null | undefined;
    }) => saveGymLogo(gymId, photo, oldPath),
    onSuccess: (path) => {
      const { profile, setProfile } = useAuthStore.getState();
      if (!profile) return;
      setProfile({
        ...profile,
        gyms: profile.gyms.map((g) =>
          g.gymId === gymId ? { ...g, logoPath: path, logoUrl: gymLogoUrl(path) } : g,
        ),
      });
    },
  });
}
