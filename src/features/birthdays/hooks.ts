import { useMutation, useQueryClient } from '@tanstack/react-query';

import { sendBirthdayWish, setMemberBirthday } from '@/features/birthdays/api';
import { memberKeys } from '@/features/members/hooks';

/** Saves a member's date of birth, then refreshes the people list it shows in. */
export function useSetMemberBirthday(gymId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, dateOfBirth }: { memberId: string; dateOfBirth: string }) =>
      setMemberBirthday(gymId, memberId, dateOfBirth),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: memberKeys.people(gymId) }),
  });
}

export function useSendBirthdayWish(gymId: string, gymName: string) {
  return useMutation({
    mutationFn: (memberId: string) => sendBirthdayWish(gymId, gymName, memberId),
  });
}
