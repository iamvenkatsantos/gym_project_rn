import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { restoreProfile } from '@/features/auth/api';
import { useAuthStore } from '@/features/auth/auth-store';
import {
  acceptGymInvite,
  declineGymInvite,
  getHistorySharing,
  listMyGymInvites,
  setHistorySharing,
} from '@/features/gym-invites/api';
import { progressKeys } from '@/features/progress/hooks';

export const gymInviteKeys = {
  all: ['gym-invites'] as const,
  mine: () => [...gymInviteKeys.all, 'mine'] as const,
  sharing: (gymId: string, userId: string) =>
    [...gymInviteKeys.all, 'sharing', gymId, userId] as const,
};

export function useMyGymInvites() {
  return useQuery({ queryKey: gymInviteKeys.mine(), queryFn: listMyGymInvites });
}

/** Joins or declines; joining reloads the profile so the new gym shows up. */
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
      await acceptGymInvite(inviteId, shareHistory);
      const profile = await restoreProfile();
      if (profile) useAuthStore.getState().setProfile(profile);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: gymInviteKeys.all }),
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
