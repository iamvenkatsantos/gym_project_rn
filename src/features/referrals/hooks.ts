import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { listMyReferrals, referFriend } from '@/features/referrals/api';

export const referralKeys = {
  mine: (gymId: string, memberId: string) => ['referrals', gymId, memberId] as const,
};

export function useMyReferrals(gymId: string, memberId: string) {
  return useQuery({
    queryKey: referralKeys.mine(gymId, memberId),
    queryFn: () => listMyReferrals(gymId, memberId),
  });
}

export function useReferFriend(gymId: string, memberId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (friend: { fullName: string; phone: string }) =>
      referFriend(gymId, memberId, friend),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: referralKeys.mine(gymId, memberId) }),
  });
}
