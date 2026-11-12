import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  acceptGymInvite,
  declineGymInvite,
  getHistorySharing,
  listMovedMembers,
  listMyGymInvites,
  setHistorySharing,
} from '@/features/gym-invites/api';
import { progressKeys } from '@/features/progress/hooks';

export const gymInviteKeys = {
  all: ['gym-invites'] as const,
  mine: () => [...gymInviteKeys.all, 'mine'] as const,
  sharing: (gymId: string, userId: string) =>
    [...gymInviteKeys.all, 'sharing', gymId, userId] as const,
  moved: (gymId: string) => [...gymInviteKeys.all, 'moved', gymId] as const,
};

export function useMovedMembers(gymId: string) {
  return useQuery({
    queryKey: gymInviteKeys.moved(gymId),
    queryFn: () => listMovedMembers(gymId),
  });
}

export function useMyGymInvites() {
  return useQuery({ queryKey: gymInviteKeys.mine(), queryFn: listMyGymInvites });
}

/**
 * Joins or declines. Joining moves them out of their other gyms (owners stay), reloads the
 * profile and opens the new gym.
 */
export function useAnswerGymInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      inviteId,
      join,
      shareHistory = false,
    }: {
      inviteId: string;
      join: boolean;
      shareHistory?: boolean;
    }) => {
      if (!join) return declineGymInvite(inviteId);
      const gymId = await acceptGymInvite(inviteId, shareHistory);
      const { setProfile, setActiveGym } = useAuthStore.getState();
      const profile = await restoreProfile();
      if (profile) setProfile(profile);
      if (profile?.gyms.some((g) => g.gymId === gymId)) {
        setActiveGym(gymId);
        router.dismissTo('/');
      }
    },
    // Every gym's data changes when someone moves, so refetch everything.
    onSettled: () => queryClient.invalidateQueries(),
  });
}

export function useHistorySharing(gymId: string, userId: string) {
  return useQuery({
    queryKey: gymInviteKeys.sharing(gymId, userId),
    queryFn: () => getHistorySharing(gymId, userId),
  });
}

export function useSetHistorySharing(gymId: string, userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (share: boolean) => setHistorySharing(gymId, share),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: gymInviteKeys.sharing(gymId, userId) });
      queryClient.invalidateQueries({ queryKey: progressKeys.all });
    },
  });
}
